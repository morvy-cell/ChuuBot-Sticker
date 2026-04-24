const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Sticker, StickerTypes } = require("wa-sticker-formatter")
const express = require("express")
const pino = require("pino")

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys")

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: "silent" }) // Tira os logs poluídos
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update

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

        // Se for imagem
        if (type === "imageMessage") {
            try {
                await sock.sendMessage(jid, { text: "Recebi! Criando sua figurinha sem fundo..." })

                // Baixa a imagem
                const buffer = await sock.downloadMediaMessage(msg)

                // Cria o sticker - já redimensiona
                const sticker = new Sticker(buffer, {
                    pack: "Figurinhas", // Nome do pacote
                    author: "Chuu Bot", // Autor
                    type: StickerTypes.FULL, // Tela cheia
                    categories: ["🤩", "🎉"], // Emojis do pack
                    id: "12345", // ID do pack
                    quality: 70, // Qualidade 0-100
                    
                })

                // Envia como figurinha
                await sock.sendMessage(jid, await sticker.toMessage())
                await sock.sendMessage(jid, { text: "Pronto! Toca pra salvar 👆" })

            } catch (e) {
                console.log("Erro ao criar sticker:", e)
                await sock.sendMessage(jid, { text: "Opa, deu erro aqui. Manda outra foto?" })
            }

        // Se for qualquer outra coisa
        } else if (type === "conversation" || type === "extendedTextMessage") {
             await sock.sendMessage(jid, { text: "Me manda uma foto que eu transformo em figurinha pra você" })
        }
    })
}

connectBot()

// Servidor pra manter Railway/Replit online
const app = express()
const port = process.env.PORT || 3000
app.get("/", (req, res) => res.send("Bot tá online!"))
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`))
