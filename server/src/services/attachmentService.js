const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { emitToBoard } = require('../lib/socket');
const activity = require('./activityService');
const { deleteFileByUrl, getFileUrl, UPLOAD_FOLDERS } = require('../middleware/upload');
const { USER_LITE_SELECT, toAttachment, getCardSummary } = require('./boardFormat');

/**
 * attachment.changed payload: the attachment (or { id, deleted: true }) plus
 * cardId and the refreshed CardSummary so clients can update counts.
 */
const emitChanged = async (cardId, attachmentPayload, ctx) => {
  const card = await getCardSummary(cardId);
  emitToBoard(card.boardId, 'attachment.changed', { ...attachmentPayload, cardId, card }, ctx.userId);
};

const addAttachment = async (cardId, file, ctx) => {
  if (!file) throwError('No file uploaded (multipart field "file")', 400);
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true, boardId: true } });
  if (!card) {
    await deleteFileByUrl(getFileUrl(null, file.filename, UPLOAD_FOLDERS.ATTACHMENTS));
    throwError('Card not found', 404);
  }

  const attachment = await prisma.attachment.create({
    data: {
      cardId,
      uploaderId: ctx.userId,
      fileName: file.originalname.slice(0, 255),
      url: getFileUrl(null, file.filename, UPLOAD_FOLDERS.ATTACHMENTS),
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    },
    include: { uploader: USER_LITE_SELECT },
  });

  await activity.log({
    type: 'attachment.added', boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId,
    data: { attachmentId: attachment.id, fileName: attachment.fileName },
  });

  const payload = toAttachment(attachment);
  await emitChanged(cardId, payload, ctx);
  return payload;
};

const deleteAttachment = async (id, ctx) => {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) throwError('Attachment not found', 404);
  await prisma.attachment.delete({ where: { id } });
  await deleteFileByUrl(attachment.url);
  await emitChanged(attachment.cardId, { id, deleted: true }, ctx);
};

module.exports = { addAttachment, deleteAttachment };
