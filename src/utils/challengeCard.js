const path = require('path');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  TextDisplayBuilder
} = require('discord.js');

const MB = 1024 * 1024;
const UPLOAD_LIMIT_BY_BOOST_TIER = [10 * MB, 10 * MB, 50 * MB, 100 * MB];

function buildCard({ body, status, videoNames = [], buttons = [] }) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(status));

  if (videoNames.length) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder()
      .addItems(...videoNames.map(name => item => item.setURL(`attachment://${name}`))));
  }
  if (buttons.length) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function cardBody(message) {
  return message.components[0].components[0].content;
}

function landingModal(customId, title) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addLabelComponents(new LabelBuilder()
      .setLabel('Your clip')
      .setDescription('Upload a video of you landing it.')
      .setFileUploadComponent(new FileUploadBuilder().setCustomId('video').setMinValues(1).setMaxValues(1)));
}

function uploadLimit(guild) {
  return UPLOAD_LIMIT_BY_BOOST_TIER[guild?.premiumTier ?? 0];
}

function videoProblem(attachment, guild) {
  if (!attachment.contentType?.startsWith('video/')) return '⚠️ That file isn\'t a video — upload a clip of you landing it.';
  const limit = uploadLimit(guild);
  if (attachment.size > limit) return `⚠️ That clip is over this server's ${limit / MB} MB limit — trim it down and try again.`;
  return null;
}

async function videoFile(attachment, name) {
  const response = await fetch(attachment.url);
  const extension = path.extname(attachment.name) || '.mp4';
  return new AttachmentBuilder(Buffer.from(await response.arrayBuffer()), { name: `${name}${extension}` });
}

module.exports = { buildCard, cardBody, landingModal, videoProblem, videoFile };
