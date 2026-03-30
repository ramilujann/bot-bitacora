const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const TOKEN = process.env.TOKEN;
const LOG_CHANNEL_ID = "1480713655220965518";
const REPORTE_CHANNEL_ID = "1488082778242154627";

// =====================
// SUPABASE
// =====================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// =====================
// FUNCION SEMANA
// =====================
function getRangoSemana() {
  const ahora = new Date();
  const dia = ahora.getDay(); // domingo = 0

  const inicio = new Date(ahora);
  inicio.setDate(ahora.getDate() - dia);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);
  fin.setHours(21, 0, 0, 0);

  return {
    inicio: inicio.toISOString(),
    fin: fin.toISOString()
  };
}

// =====================
// COMANDOS
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName('verhoras')
    .setDescription('Ver horas actuales'),

  new SlashCommandBuilder()
    .setName('cierresemanal')
    .setDescription('Ver cierre semanal')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
  '1480708761889804308', // BOT ID
  'ID_DEL_SERVIDOR' // SERVER ID
)
      { body: commands }
    );
    console.log('Comandos registrados');
    console.log("✅ /verhoras y /cierresemanal listos");
  } catch (error) {
    console.error(error);
  }
})();

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const turnos = new Map();

client.once("ready", () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
});

// =====================
// EVENTO PRINCIPAL
// =====================
client.on("interactionCreate", async (interaction) => {

  // =====================
  // COMANDOS
  // =====================
  if (interaction.isChatInputCommand()) {

    const { inicio, fin } = getRangoSemana();

    const { data, error } = await supabase
      .from("horas")
      .select("*")
      .gte("created_at", inicio)
      .lte("created_at", fin);

    if (error) {
      console.log(error);
      return interaction.reply("Error al obtener datos");
    }

    const ranking = {};

    data.forEach(row => {
      if (!ranking[row.nombre]) ranking[row.nombre] = 0;
      ranking[row.nombre] += row.tiempo;
    });

    const sorted = Object.entries(ranking)
      .sort((a, b) => b[1] - a[1]);

    // =====================
    // /verhoras
    // =====================
    if (interaction.commandName === "verhoras") {

      let texto = "📊 HORAS SEMANALES\n\n";

      sorted.forEach(([nombre, tiempo], i) => {
        const horas = (tiempo / 60).toFixed(1);
        texto += `${i + 1}. ${nombre} — ${horas}h\n`;
      });

      return interaction.reply(texto);
    }

    // =====================
    // /cierresemanal
    // =====================
    if (interaction.commandName === "cierresemanal") {

      let cierre = "📊 CIERRE SEMANAL\n\n";

      sorted.forEach(([nombre, tiempo]) => {
        const horas = (tiempo / 60).toFixed(1);
        cierre += `${nombre} — ${horas}h ${horas >= 8 ? "✅" : "❌"}\n`;
      });

      // MANDA AL CANAL AUTOMATICO
      const canal = await client.channels.fetch(REPORTE_CHANNEL_ID);
      canal.send(cierre);

      return interaction.reply(cierre);
    }

    return;
  }

  // =====================
  // BOTONES
  // =====================
  if (!interaction.isButton()) return;

  const user = interaction.user;

  // =====================
  // INICIO TURNO
  // =====================
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

  // =====================
  // FIN TURNO
  // =====================
  if (interaction.customId === "salida") {

    if (!turnos.has(user.id)) {
      return interaction.reply({ content: "⚠️ No tenés turno iniciado.", ephemeral: true });
    }

    const inicio = turnos.get(user.id);
    const fin = Date.now();

    const tiempoMin = Math.floor((fin - inicio) / 60000);

    // GUARDAR
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
// =====================
// RESET AUTOMÁTICO DOMINGO 21HS
// =====================

let ultimoReset = null;

function esDomingo21() {
  const ahora = new Date();

  const esDomingo = ahora.getDay() === 0;
  const es21 = ahora.getHours() >= 21;

  const hoy = ahora.toDateString();

  // evita repetir reset
  if (ultimoReset === hoy) return false;

  return esDomingo && es21;
}

// chequea cada 1 minuto
setInterval(async () => {
  try {
    if (esDomingo21()) {
      console.log("🔄 RESET SEMANAL AUTOMÁTICO");

      await supabase.from("horas").delete().neq("id", "");

      ultimoReset = new Date().toDateString();

      const canal = await client.channels.fetch(REPORTE_CHANNEL_ID);
      canal.send("📅 Nueva semana iniciada automáticamente. Bitácora reiniciada.");
    }
  } catch (err) {
    console.error("Error en reset automático:", err);
  }
}, 60000);
