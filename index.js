const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const http = require('http');

const PHONE_NUMBER = "5562981573734";

// Servidor fake para não ser morto
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot rodando');
}).listen(process.env.PORT || 10000);

console.log('🚀 Servidor fake iniciado');

async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Bot Figurinhas Dedão', 'Chrome', '1.0'],
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr || connection === 'connecting') {
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log('\n🔑 CÓDIGO DE PAREAMENTO:');
                console.log(code);
                console.log('\nWhatsApp Business → Configurações → Dispositivos vinculados → "Conectar com número de telefone"');
                console.log('Digite o código acima');
            } catch (e) {
                console.log('Pairing falhou, mostrando QR Code...');
                if (qr) qrcode.generate(qr, { small: true });
            }
        }

        if (connection === 'open') {
            console.log('\n✅ BOT CONECTADO COM SUCESSO!');
        }

        if (connection === 'close') {
            console.log('Conexão fechada. Reconectando em 10 segundos...');
            setTimeout(conectar, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').toLowerCase().trim();

        const hasMedia = msg.message.imageMessage || msg.message.videoMessage ||
                        msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                        msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

        if (!hasMedia && texto !== '/s' && texto !== '/s2') return;

        console.log('📸 Criando sticker...');

        try {
            const buffer = await sock.downloadMediaMessage(msg);

            const sticker = new Sticker(buffer, {
                pack: 'Bot do',
                author: 'Dedão',
                type: StickerTypes.FULL,
                quality: 80,
            });

            const stickerBuffer = await sticker.toBuffer();

            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });

        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: '❌ Erro ao criar sticker.' });
        }
    });
}

conectar();
