const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = "1478141185250951278";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {

const row = new ActionRowBuilder()
.addComponents(
new ButtonBuilder()
.setCustomId("entrada")
.setLabel("🟢 Iniciar Turno")
.setStyle(ButtonStyle.Success),

new ButtonBuilder()
.setCustomId("salida")
.setLabel("🔴 Finalizar Turno")
.setStyle(ButtonStyle.Danger)
);

const canal = await client.channels.fetch(CHANNEL_ID);

canal.send({
content: "🔧 **BITÁCORA TALLER**\n\nPresioná un botón para registrar tu turno.",
components: [row]
});

console.log("Panel creado");

});

client.login(TOKEN);