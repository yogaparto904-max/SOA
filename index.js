require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require("discord.js");

const INPUT_CHANNEL_ID = "1517351024786931772";
const STOCK_CHANNEL_ID = "1517351098212679831";
const AUDIT_CHANNEL_ID = "1517351198267674725";

const ITEMS = ["Copper", "Steel", "Metal Scrap", "Cannabis"];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= FILE HANDLER =================
function readData() {
  return JSON.parse(fs.readFileSync("./data.json", "utf8"));
}

function saveData(data) {
  fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
}

function readHistory() {
  return JSON.parse(fs.readFileSync("./history.json", "utf8"));
}

function saveHistory(data) {
  fs.writeFileSync("./history.json", JSON.stringify(data, null, 2));
}

// ================= STOCK MESSAGE =================
async function updateStockMessage() {
  const channel = await client.channels.fetch(STOCK_CHANNEL_ID);
  const data = readData();

  const embed = new EmbedBuilder()
    .setTitle("🏦 BRANKAS KOTA")
    .setDescription(
      `⛏️ Copper : ${data["Copper"]}\n` +
      `🔩 Steel : ${data["Steel"]}\n` +
      `🗑️ Metal Scrap : ${data["Metal Scrap"]}\n` +
      `🌿 Cannabis : ${data["Cannabis"]}`
    )
    .setFooter({ text: `Update: ${new Date().toLocaleString()}` });

  const msgs = await channel.messages.fetch({ limit: 20 });
  const botMsg = msgs.find(m => m.author.id === client.user.id);

  if (botMsg) {
    await botMsg.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}

// ================= PANEL =================
async function sendPanel() {
  const channel = await client.channels.fetch(INPUT_CHANNEL_ID);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("action_menu")
    .setPlaceholder("Pilih aksi")
    .addOptions([
      { label: "Deposit Barang", value: "deposit", emoji: "📥" },
      { label: "Withdraw Barang", value: "withdraw", emoji: "📤" },
      { label: "Lihat Stok", value: "stock", emoji: "📊" }
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  await channel.send({
    content: "🏦 Panel Brankas",
    components: [row]
  });
}

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`Login sebagai ${client.user.tag}`);
  await updateStockMessage();
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async interaction => {

  // ===== SELECT MENU =====
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "action_menu") {
      const action = interaction.values[0];

      if (action === "stock") {
        const data = readData();

        const embed = new EmbedBuilder()
          .setTitle("📊 Stok Brankas")
          .setDescription(
            `⛏️ Copper : ${data["Copper"]}\n` +
            `🔩 Steel : ${data["Steel"]}\n` +
            `🗑️ Metal Scrap : ${data["Metal Scrap"]}\n` +
            `🌿 Cannabis : ${data["Cannabis"]}`
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const itemMenu = new StringSelectMenuBuilder()
        .setCustomId(`item_${action}`)
        .setPlaceholder("Pilih Barang")
        .addOptions(
          ITEMS.map(item => ({
            label: item,
            value: item
          }))
        );

      return interaction.reply({
        content: "Pilih Barang",
        components: [new ActionRowBuilder().addComponents(itemMenu)],
        ephemeral: true
      });
    }

    if (interaction.customId.startsWith("item_")) {
      const action = interaction.customId.split("_")[1];
      const item = interaction.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`${action}|${item}`)
        .setTitle(`${action.toUpperCase()} - ${item}`);

      const jumlah = new TextInputBuilder()
        .setCustomId("jumlah")
        .setLabel("Masukkan Jumlah")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(jumlah)
      );

      return interaction.showModal(modal);
    }
  }

  // ===== MODAL =====
  if (interaction.isModalSubmit()) {

    const [action, item] = interaction.customId.split("|");
    const amount = parseInt(interaction.fields.getTextInputValue("jumlah"));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "Jumlah tidak valid.",
        ephemeral: true
      });
    }

    const data = readData();
    const oldStock = data[item];

    if (action === "withdraw" && oldStock < amount) {
      return interaction.reply({
        content: `Stok ${item} tidak mencukupi.`,
        ephemeral: true
      });
    }

    if (action === "deposit") {
      data[item] += amount;
    } else {
      data[item] -= amount;
    }

    saveData(data);

    const history = readHistory();
    history.push({
      user: interaction.user.tag,
      action,
      item,
      amount,
      oldStock,
      newStock: data[item],
      date: new Date().toISOString()
    });
    saveHistory(history);

    const audit = await client.channels.fetch(AUDIT_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle(action === "deposit" ? "📥 Deposit" : "📤 Withdraw")
      .addFields(
        { name: "User", value: interaction.user.tag },
        { name: "Barang", value: item },
        { name: "Jumlah", value: String(amount) },
        { name: "Stok Lama", value: String(oldStock) },
        { name: "Stok Baru", value: String(data[item]) }
      );

    await audit.send({ embeds: [embed] });

    await updateStockMessage();

    return interaction.reply({
      content: `Berhasil ${action} ${amount} ${item}`,
      ephemeral: true
    });
  }
});

// ================= DEBUG =================
console.log("TOKEN ADA?", !!process.env.TOKEN);

// ================= LOGIN =================
client.login(process.env.TOKEN);
