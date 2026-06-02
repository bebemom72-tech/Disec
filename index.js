const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const config = require("./config.json");
let stock = require("./stock.json");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===================== HELP =====================
function showHelp(message) {
    message.reply(`
🛒 الأوامر:
!add 1m
!add 3m
!stock
!buy 1m
!buy 3m
!مزاد
`);
}

// ===================== SAVE =====================
function saveStock() {
    fs.writeFileSync("./stock.json", JSON.stringify(stock, null, 2));
}

// ===================== FIND CHANNEL =====================
function getFreeChannel(guild) {
    return config.auctionChannels
        .map(id => guild.channels.cache.get(id))
        .find(c => c);
}

let activeAuction = false;

// ===================== MESSAGE =====================
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    if (cmd === "!help") return showHelp(message);

    // STOCK
    if (cmd === "!stock") {
        return message.reply(`📦 المخزون:
1m: ${stock["1m"]?.length || 0}
3m: ${stock["3m"]?.length || 0}`);
    }

    // ADD
    if (cmd === "!add") {
        if (!message.member?.roles?.cache.has(config.adminRole))
            return message.reply("❌ ما عندك صلاحية");

        const type = args[1];
        if (!stock[type]) return message.reply("❌ نوع غير صحيح");

        const code = `NITRO-${Math.random().toString(36).slice(2, 10)}`;

        stock[type].push(code);
        saveStock();

        return message.reply(`✅ تم إضافة ${type}`);
    }

    // BUY
    if (cmd === "!buy") {
        const type = args[1];

        if (!stock[type] || stock[type].length === 0)
            return message.reply("❌ لا يوجد مخزون");

        const code = stock[type].shift();
        saveStock();

        try {
            await message.author.send(`🎉 طلبك:\n${type}\nالكود: ${code}`);
            message.reply("📩 تم الإرسال في الخاص");
        } catch {
            message.reply("❌ ما قدرت أرسل لك خاص");
        }
    }

    // AUCTION
    if (cmd === "!مزاد") {
        if (activeAuction)
            return message.reply("❌ يوجد مزاد شغال");

        const channel = getFreeChannel(message.guild);
        if (!channel) return message.reply("❌ لا يوجد روم مزاد");

        activeAuction = true;

        let step = 0;
        let item = "";
        let startPrice = 0;

        message.reply("📦 اكتب اسم السلعة:");

        const collector = message.channel.createMessageCollector({
            time: 60000,
            filter: m => m.author.id === message.author.id
        });

        collector.on("collect", msg => {
            step++;

            if (step === 1) {
                item = msg.content;
                msg.delete().catch(() => {});
                msg.channel.send("💰 اكتب السعر:");
            }

            if (step === 2) {
                startPrice = Number(msg.content);
                msg.delete().catch(() => {});
                collector.stop();

                startAuction(channel, message.author, item, startPrice);
            }
        });
    }
});

// ===================== AUCTION =====================
function startAuction(channel, owner, item, startPrice) {
    let currentBid = startPrice;
    let lastBidder = null;

    channel.send(`
🏆 مزاد جديد
👤 صاحب المزاد: <@${owner.id}>
📦 السلعة: ${item}
💰 السعر: ${startPrice}
`);

    const collector = channel.createMessageCollector({
        filter: m => !m.author.bot
    });

    collector.on("collect", msg => {
        const amount = Number(msg.content);

        if (!amount) return;

        if (amount <= currentBid) {
            msg.react("❌").catch(() => {});
            return;
        }

        currentBid = amount;
        lastBidder = msg.author.id;

        msg.react("✅").catch(() => {});
    });

    setTimeout(() => {
        channel.send(`⏳ باقي دقيقتين على نهاية المزاد`);
    }, 240000);

    setTimeout(() => {
        collector.stop();

        channel.send(`
🏁 انتهى المزاد

🏆 الفائز: ${lastBidder ? `<@${lastBidder}>` : "لا يوجد"}
💰 السعر النهائي: ${currentBid}
👤 صاحب المزاد: <@${owner.id}>
        `);

        activeAuction = false;
    }, 300000);
}

// ===================== LOGIN =====================
client.login(process.env.TOKEN);
