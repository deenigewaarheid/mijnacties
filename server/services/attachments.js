const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DOC_TYPES   = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const AUDIO_EXTS  = /\.(mp3|m4a|ogg|wav|webm|mpeg|aac)$/i;
const AUDIO_MIME  = /^audio\//i;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB — Claude limit

async function extractDocText(buffer, mimeType, filename) {
    try {
        if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) {
            const parsed = await pdfParse(buffer);
            return parsed.text?.trim() || '';
        }
        if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            filename?.endsWith('.docx')
        ) {
            const result = await mammoth.extractRawText({ buffer });
            return result.value?.trim() || '';
        }
    } catch (err) {
        console.error(`Error extracting text from ${filename}:`, err.message);
    }
    return '';
}

async function transcribeAudio(buffer, mimeType, filename) {
    if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  OPENAI_API_KEY not set, skipping audio transcription');
        return '';
    }
    try {
        const { OpenAI, toFile } = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const ext    = (filename?.split('.').pop() || 'mp3').toLowerCase();
        const file   = await toFile(buffer, `audio.${ext}`, { type: mimeType });
        const result = await openai.audio.transcriptions.create({
            file,
            model:    'whisper-1',
            language: 'nl',
        });
        return result.text?.trim() || '';
    } catch (err) {
        console.error('Error transcribing audio:', err.message);
        return '';
    }
}

/**
 * Process attachment array into { textContent, images }.
 * @param {Array<{ buffer: Buffer, mimeType: string, filename: string }>} attachments
 * @returns {{ textContent: string, images: Array<{ mimeType, data, filename }> }}
 */
async function processAttachments(attachments) {
    const textParts = [];
    const images    = [];

    for (const { buffer, mimeType, filename } of attachments) {
        if (IMAGE_TYPES.includes(mimeType)) {
            if (buffer.length <= MAX_IMAGE_BYTES) {
                images.push({ mimeType, data: buffer.toString('base64'), filename });
            } else {
                console.log(`Skipping large image ${filename} (${buffer.length} bytes)`);
            }
        } else if (DOC_TYPES.includes(mimeType) || filename?.endsWith('.pdf') || filename?.endsWith('.docx')) {
            const text = await extractDocText(buffer, mimeType, filename);
            if (text) textParts.push(`[Bijlage: ${filename}]\n${text}`);
        } else if (AUDIO_MIME.test(mimeType) || AUDIO_EXTS.test(filename || '')) {
            const text = await transcribeAudio(buffer, mimeType, filename);
            if (text) textParts.push(`[Audiobijlage: ${filename}]\nTranscriptie: ${text}`);
        }
    }

    return { textContent: textParts.join('\n\n'), images };
}

module.exports = { processAttachments };
