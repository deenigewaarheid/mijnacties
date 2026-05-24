const { google } = require('googleapis');
const { query } = require('../database/db');
require('dotenv').config();

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
);

// Gmail API
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Generate Gmail authorization URL
 */
function getAuthUrl() {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokens(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

/**
 * Set user credentials for Gmail API
 */
function setUserCredentials(userId, tokens) {
    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
    });
}

/**
 * Refresh access token if expired
 */
async function refreshAccessToken(userId) {
    try {
        // Get refresh token from database
        const result = await query(
            'SELECT gmail_refresh_token FROM users WHERE id = $1',
            [userId]
        );
        
        if (!result.rows[0] || !result.rows[0].gmail_refresh_token) {
            throw new Error('No refresh token found');
        }
        
        oauth2Client.setCredentials({
            refresh_token: result.rows[0].gmail_refresh_token
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update database with new access token
        await query(
            `UPDATE users 
             SET gmail_access_token = $1, 
                 gmail_token_expiry = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [credentials.access_token, new Date(credentials.expiry_date), userId]
        );
        
        return credentials;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

/**
 * Get user's Gmail messages with label filter
 */
async function getMessages(userId, labelName = 'Analyzer', maxResults = 10) {
    try {
        // Ensure token is valid
        await refreshAccessToken(userId);
        
        // Get label ID by name
        const labelsRes = await gmail.users.labels.list({ userId: 'me' });
        const label = labelsRes.data.labels.find(l => l.name === labelName);
        
        if (!label) {
            console.log(`Label "${labelName}" not found. Creating...`);
            await createLabel(labelName);
            return [];
        }
        
        // Get messages with label
        const response = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [label.id],
            maxResults
        });
        
        if (!response.data.messages) {
            return [];
        }
        
        // Get full message details
        const messages = await Promise.all(
            response.data.messages.map(msg => getMessageDetails(msg.id))
        );
        
        return messages;
    } catch (error) {
        console.error('Error getting messages:', error);
        throw error;
    }
}

/**
 * Get full message details
 */
async function getMessageDetails(messageId) {
    try {
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });
        
        const message = response.data;
        const headers = message.payload.headers;
        
        // Extract key info
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        // Get email body
        let body = '';
        if (message.payload.body.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        } else if (message.payload.parts) {
            const textPart = message.payload.parts.find(
                part => part.mimeType === 'text/plain'
            );
            if (textPart && textPart.body.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
        }
        
        // Extract email address and name
        const fromMatch = from.match(/(.*?)\s*<(.+?)>/) || [null, from, from];
        const fromName = fromMatch[1]?.trim() || '';
        const fromEmail = fromMatch[2]?.trim() || from;
        
        return {
            id: message.id,
            from: fromEmail,
            fromName,
            subject,
            body,
            date: new Date(date),
            internalDate: new Date(parseInt(message.internalDate))
        };
    } catch (error) {
        console.error('Error getting message details:', error);
        throw error;
    }
}

/**
 * Create Gmail label
 */
async function createLabel(labelName) {
    try {
        await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
                name: labelName,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show'
            }
        });
        console.log(`✓ Created label: ${labelName}`);
    } catch (error) {
        console.error('Error creating label:', error);
        throw error;
    }
}

/**
 * Remove label from message
 */
async function removeLabel(messageId, labelName) {
    try {
        const labelsRes = await gmail.users.labels.list({ userId: 'me' });
        const label = labelsRes.data.labels.find(l => l.name === labelName);
        
        if (label) {
            await gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    removeLabelIds: [label.id]
                }
            });
        }
    } catch (error) {
        console.error('Error removing label:', error);
    }
}

/**
 * Archive message (remove from inbox)
 */
async function archiveMessage(messageId) {
    try {
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            requestBody: {
                removeLabelIds: ['INBOX']
            }
        });
    } catch (error) {
        console.error('Error archiving message:', error);
    }
}

/**
 * Poll Gmail for new messages (run periodically)
 */
async function pollGmail(userId) {
    try {
        console.log(`📧 Polling Gmail for user ${userId}...`);
        
        const messages = await getMessages(userId);
        
        if (messages.length === 0) {
            console.log('No new messages');
            return [];
        }
        
        console.log(`Found ${messages.length} new message(s)`);
        
        // Process each message
        const newMails = [];
        for (const message of messages) {
            // Check if already in database
            const existing = await query(
                'SELECT id FROM mails WHERE gmail_message_id = $1 AND user_id = $2',
                [message.id, userId]
            );
            
            if (existing.rows.length > 0) {
                console.log(`Message ${message.id} already processed, removing label`);
                await removeLabel(message.id, 'Analyzer');
                continue;
            }
            
            newMails.push(message);
        }
        
        return newMails;
    } catch (error) {
        console.error('Error polling Gmail:', error);
        return [];
    }
}

module.exports = {
    getAuthUrl,
    getTokens,
    setUserCredentials,
    refreshAccessToken,
    getMessages,
    getMessageDetails,
    removeLabel,
    archiveMessage,
    pollGmail
};
