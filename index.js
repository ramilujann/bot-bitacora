const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const TOKEN = process.env.TOKEN;
const LOG_CHANNEL_ID = "1480713655220965518"; // tu canal logs
const REPORTE_CHANNEL_ID = "1488082778242154627"; // ⚠️ CAMBIAR

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// COMANDO /verhoras
const commands = [
  new SlashCommandBuilder()
    .setName('verhoras')
    .setDescription('Ver ranking de horas de mecánicos')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands('1480708761889804308'), // TU CLIENT ID
      { body: commands }
    );
    console.log('Comando /verhoras registrado');
  } catch (error) {
    console.error(error);
  }
})();

// CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const turnos = new Map();

client.once("ready", () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

// EVENTO PRINCIPAL
client.on("interactionCreate", async (interaction) => {

  // =====================
  // COMANDO /verhoras
  // =====================
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "verhoras") {

      const { data, error } = await supabase
        .from("horas")
        .select("*");

      if (error) {
        console.log(error);
        return interaction.reply({ content: "Error al obtener datos", ephemeral: true });
      }

      const ranking = {};

      data.forEach(row => {
        if (!ranking[row.nombre]) {
          ranking[row.nombre] = 0;
        }
        ranking[row.nombre] += row.tiempo;
      });

      const sorted = Object.entries(ranking)
        .sort((a, b) => b[1] - a[1]);

      let texto = "🏆 **Ranking de Mecánicos**\n\n";

      sorted.forEach(([nombre, tiempo], index) => {
        texto += `${index + 1}. ${nombre} — ${tiempo} min\n`;
      });

      await interaction.reply(texto);

      const canal = await client.channels.fetch(REPORTE_CHANNEL_ID);
      canal.send(`📊 Reporte semanal:\n\n${texto}`);
    }
  }

  // =====================
  // BOTONES
  // =====================
  if (!interaction.isButton()) return;

  const user = interaction.user;

  // INICIO
  if (interaction.customId === "entrada") {

    if (turnos.has(user.id)) {
      return interaction.reply({ content: "⚠️ Ya estás en turno.", ephemeral: true });
    }

    turnos.set(user.id, Date.now());

    const embed = new EmbedBuilder()
      .setTitle("🟢 Inicio de Turno")
      .addFields(
        { name: "Empleado", value: interaction.member.displayName },
        { name: "Hora", value: `<t:${Math.floor(Date.now()/1000)}:T>` }
      )
      .setColor("Green");

    const canal = await client.channels.fetch(LOG_CHANNEL_ID);
    canal.send({ embeds: [embed] });

    interaction.reply({ content: "Turno iniciado correctamente.", ephemeral: true });
  }

  // SALIDA
  if (interaction.customId === "salida") {

    if (!turnos.has(user.id)) {
      return interaction.reply({ content: "⚠️ No tenés turno iniciado.", ephemeral: true });
    }

    const inicio = turnos.get(user.id);
    const fin = Date.now();

    const tiempoMin = Math.floor((fin - inicio) / 60000);

    // GUARDAR EN SUPABASE
    const { data, error } = await supabase.from("horas").insert([
      {
        user_id: user.id,
        nombre: interaction.member.displayName,
        tiempo: tiempoMin
      }
    ]);

    console.log("SUPABASE RESULT:", data, error);

    const tiempo = Math.floor((fin - inicio) / 1000);
    const horas = Math.floor(tiempo / 3600);
    const minutos = Math.floor((tiempo % 3600) / 60);

    turnos.delete(user.id);

    const embed = new EmbedBuilder()
      .setTitle("🔴 Fin de Turno")
      .addFields(
        { name: "Empleado", value: interaction.member.displayName },
        { name: "Tiempo trabajado", value: `${horas}h ${minutos}m` }
      )
      .setColor("Red");

    const canal = await client.channels.fetch(LOG_CHANNEL_ID);
    canal.send({ embeds: [embed] });

    interaction.reply({ content: "Turno finalizado.", ephemeral: true });
  }
});

client.login(TOKEN);
