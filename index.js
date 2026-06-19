client.on(Events.InteractionCreate, async interaction => {

  // ================= SELECT MENU =================
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
  } // ✅ INI PENUTUP SELECT MENU

  // ================= MODAL =================
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
