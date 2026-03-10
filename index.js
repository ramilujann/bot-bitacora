const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TOKEN = process.env.TOKEN;
const LOG_CHANNEL_ID = "1480713655220965518";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const turnos = new Map();

client.once("ready", () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  const user = interaction.user;

  if (interaction.customId === "entrada") {

    if (turnos.has(user.id)) {
      return interaction.reply({ content: "⚠️ Ya estás en turno.", ephemeral: true });
    }

    turnos.set(user.id, Date.now());

    const embed = new EmbedBuilder()
      .setTitle("🟢 Inicio de Turno")
      .addFields(
        { name: "Empleado", value: user.username },
        { name: "Hora", value: `<t:${Math.floor(Date.now()/1000)}:T>` }
      )
      .setColor("Green");

    const canal = await client.channels.fetch(LOG_CHANNEL_ID);
    canal.send({ embeds: [embed] });

    interaction.reply({ content: "Turno iniciado correctamente.", ephemeral: true });
  }

  if (interaction.customId === "salida") {

    if (!turnos.has(user.id)) {
      return interaction.reply({ content: "⚠️ No tenés turno iniciado.", ephemeral: true });
    }

    const inicio = turnos.get(user.id);
    const fin = Date.now();

    const tiempo = Math.floor((fin - inicio) / 1000);

    const horas = Math.floor(tiempo / 3600);
    const minutos = Math.floor((tiempo % 3600) / 60);

    turnos.delete(user.id);

    const embed = new EmbedBuilder()
      .setTitle("🔴 Fin de Turno")
      .addFields(
        { name: "Empleado", value: user.username },
        { name: "Tiempo trabajado", value: `${horas}h ${minutos}m` }
      )
      .setColor("Red");

    const canal = await client.channels.fetch(LOG_CHANNEL_ID);
    canal.send({ embeds: [embed] });

    interaction.reply({ content: "Turno finalizado.", ephemeral: true });
  }

});

client.login(TOKEN);