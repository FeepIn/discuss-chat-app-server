const express = require("express")
const http = require("http")
const fs = require("fs")
const jwt = require("jsonwebtoken")
const bodyParser = require("body-parser")

const app = express()
const server = http.createServer(app)
const io = require("socket.io")(server)

const PORT = process.env.PORT || 5000
const IP = process.env.IP || "localhost"

//Token secret key
const secretKey = fs.readFileSync("./secret.key", "utf-8")

//Middlewares
const auth = require("./middlewares/auth.js")

//App vars
const Room = require("./Room.js")
const User = require("./users.js")
const namesTaken = [ "System" ]
const users = []
const rooms = {
	mangaAnime: [],
	love: [],
	videoGames: [],
	space: [],
	culture: [],
	music: []
}

//Middlewares
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.text())

app.get("/rooms/:subject", (req, res) => {
	let subject = req.params.subject
	if (!subject || !Object.keys(rooms).includes(subject)) return res.status(400).end()

	res.status(200).json(getSubjectDatas(subject))
})

app.get("/subjects", (req, res) => {
	res.status(200).json(getSubjectsDatas())
})

app.post("/name", (req, res) => {
	let token = req.headers.token
	let verified = token ? jwt.verify(token, secretKey) : false

	if (verified) {
		res.status(300).json({ error: "Already connected" })
		return
	}

	let name = req.body
	name.trim()
	if (typeof name != "string") {
		res.status(400).json({ error: "Name type not string" })
		return
	} else if (namesTaken.includes(name)) {
		res.status(400).json({ error: "Name taken" })
		return
	}
	users.push(new User(name))
	token = jwt.sign(name, secretKey)
	res.status(200).send(token)
})

app.post("/createRoom", (req, res) => {
	let token = req.headers.token
	let verified = auth(token, secretKey)

	if (!verified) return res.status(400).type("text").send("Wrong token")

	user = users.find((user) => user.name == verified)

	if (!user) return res.status(400).send("User not found")

	let { roomTheme, roomName } = req.body

	if (!roomTheme || !roomName) return res.status(400).send("Wrong content")

	if (isRoomNameTaken(roomTheme, roomName)) {
		res.status(400).send("Room name taken")
	} else {
		rooms[roomTheme].push(new Room(host, roomName))
		res.status(201).end()
	}
})

io.on("connection", (socket) => {
	console.log(`Socket : ${socket.id} has connected to the server`)

	socket.on("joinRoom", (data) => {
		try {
			data = typeof data == "string" ? JSON.parse(data) : data
		} catch (error) {
			console.log(error)
			return
		}
		const { roomTheme, roomName, token } = data
		if (!roomTheme || !roomName) return

		let verified = auth(token, secretKey)
		if (!verified) {
			socket.emit("wrongToken", {})
			return
		}

		let room = findRoom(roomTheme, roomName)
		if (!room) return

		user = users.find((el) => el.name == verified)

		if (!user) return

		if (user.room) return

		user.socket = socket
		user.configureListeners()
		room.addUser(user)
		io.in(room.name).emit("newUser", { userName: user.name, color: user.color })
	})
})

server.listen(PORT, IP, () => {
	console.log(`Server is running on port ${PORT}`)
})

function findRoom(roomTheme, roomName) {
	return rooms[roomTheme].find((el, i) => el.name == roomName)
}

function isRoomNameTaken(roomTheme, roomName) {
	return rooms[roomTheme].some((el) => el.name == roomName)
}

function getSubjectDatas(subject) {
	return rooms[subject].map((el) => ({
		roomName: el.name,
		userCount: el.users.length
	}))
}

function getSubjectsDatas() {
	return Object.keys(rooms).map((el) => ({
		subjectName: el,
		userCount: rooms[el].reduce((acc, el) => acc + el.users.length, 0)
	}))
}
