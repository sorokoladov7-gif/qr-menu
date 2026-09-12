# Qrchick multimodal attachments

Qrchick admin chat accepts up to 3 images, PDFs, and text/code documents per message.

The browser compresses oversized images and sends attachment data to `/api/admin-ai-attachment`. The endpoint authenticates the administrator, analyzes the attachment with the platform's configured AI engine, and passes the resulting evidence into the normal Qrchick engineering workflow.

Inline attachment processing is limited to 3 MB per file because the Vercel Function request body limit is 4.5 MB. Large-file storage/upload can be added later without changing the chat contract.
