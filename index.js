const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Sticker, StickerTypes } = require("wa-sticker-formatter")
const express = require("express")
const pino = require("pino")
const qrcode = require("qrcode-terminal") // ← Adiciona essa lib

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys")

    const sock = makeWASocket({
        auth: state,
        // printQRInTerminal: true, ← Remove essa linha
        logger: pino({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update // ← Adiciona 'qr' aqui

        // Mostra o QR Code novo
        if (qr) {
            console.log("Escaneia o QR Code abaixo:")
            qrcode.generate(qr, { small: true }) // ← Printa o QR no console
        }

        if(connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode!== DisconnectReason.loggedOut
            console.log("Conexão caiu. Reconectando:", shouldReconnect)
            if(shouldReconnect) {
                connectBot()
            }
        } else if(connection === "open") {
            console.log("Bot conectado com sucesso!")
        }
    })

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const jid = msg.key.remoteJid
        const type = Object.keys(msg.message)[0]

        if (type === "imageMessage") {
            try {
                await sock.sendMessage(jid, { text: "Criando sua figurinha..." })
                const buffer = await sock.downloadMediaMessage(msg)

                const sticker = new Sticker(buffer, {
                    pack: "Figurinhas",
                    author: "Chuu Bot",
                    type: StickerTypes.DEFAULT,
                    quality: 70
                })

                await sock.sendMessage(jid, await sticker.toMessage())
                await sock.sendMessage(jid, { text: "Pronto! 👆" })

            } catch (e) {
                await sock.sendMessage(jid, { text: "Deu erro. Tenta outra foto" })
            }
        } else {
             await sock.sendMessage(jid, { text: "Manda uma foto pra virar sticker" })
        }
    })
}

connectBot()

const app = express()
const port = process.env.PORT || 3000
app.get("/", (req, res) => res.send("Online"))
app.listen(port)
