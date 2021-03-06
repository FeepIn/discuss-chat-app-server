const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const jwt = require("jsonwebtoken")

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "localhost";

//Vars
var namesTaken = [ "System" ];
var colors = [ "#530008", "#00655E", "#471141", "#1567AB", "#4C46C7" ];
var theme = {
	mangaAnime: [],
	love: [],
	videoGames: [],
	space: [],
	culture: [],
	music: []
};

function Room(host, roomName, roomTheme) {
	this.afkTime = 1800;
	var parent = this;
	this.roomTheme = roomTheme;
	this.addUser = addUser;
	this.deleteUser = deleteUser;
	this.tickTimer = tickTimer;
	this.resetTimer = resetTimer;
	this.destroyRoom = destroyRoom;
	this.users = [];
	this.host = host;
	this.roomName = roomName;
	this.userCount = 0;
	this.unactivityTimeSeconds = 0;
	theme[roomTheme].push(this);
	//addUser(host);
	console.log(`Room "${roomName}" has been created by "${host.name}"`);

	function addUser(user) {
		if (parent.users.includes(user)) {
			return;
		}
		parent.users.push(user);
		user.socket.join(parent.roomName);
		if (user.room == null) {
			user.roomJoined(parent);
			io
				.in(parent.roomName)
				.emit("newUser", { name: user.name, color: user.nameColor, userCount: parent.users.length });
		}
		console.log(`User "${user.name}" has joined room "${parent.roomName}"`);
	}

	function tickTimer() {
		if (this.afkTime <= 0) {
			this.destroyRoom();
		}
		this.afkTime -= 1;
	}

	function destroyRoom() {
		for (let user of this.users) {
			user.roomLeft();
		}
		theme[this.roomTheme].splice(theme[this.roomTheme].indexOf(this), 1);
	}

	function resetTimer() {
		this.afkTime = 1800;
	}

	function deleteUser(user, kicked) {
		if (!parent.users.includes(user)) {
			return;
		}
		if (kicked) {
			parent.users.splice(parent.users.indexOf(user), 1);
			user.socket.leave(parent.roomName);
			user.roomLeft();
			io
				.in(parent.roomName)
				.emit("userKicked", { name: user.name, color: user.nameColor, userCount: parent.users.length });
			user.socket.emit("kicked", {});
			console.log(`User "${user.name}" has been kicked from room "${parent.roomName}"`);
		} else {
			parent.users.splice(parent.users.indexOf(user), 1);
			user.socket.leave(parent.roomName);
			user.roomLeft();
			io
				.in(parent.roomName)
				.emit("userLeft", { name: user.name, color: user.nameColor, userCount: parent.users.length });
			console.log(`User "${user.name}" has left room "${parent.roomName}"`);

			if (parent.host == user && parent.users.length > 0) {
				parent.host = parent.users[Math.round(Math.random() * (parent.users.length - 1))];

				io.in(parent.roomName).emit("newHost", { name: parent.host.name, color: parent.host.nameColor });
			}
		}

		if (parent.users.length <= 0) {
			parent.destroyRoom();
		}
	}
}

function User(name, socket) {
	socket.emit("connected");
	this.name = name;
	this.socket = socket;
	this.room = null;
	this.nameColor = colors[Math.round(Math.random() * (colors.length - 1))];

	let configureListener = () => {
		this.socket
			.on("createRoom", (data) => {
				if (this.room != null) return;
				try {
					data = typeof data == "string" ? JSON.parse(data) : data;
				} catch (error) {
					console.log(error);
					return;
				}

				if (theme[data["roomTheme"]].some((element) => element.roomName == data["roomName"])) {
					this.socket.emit("roomNameTaken");
				} else {
					this.room = new Room(this, data["roomName"], data["roomTheme"]);
				}
			})
			.on("joinRoom", (data) => {
				if (this.room != null) return;
				try {
					data = typeof data == "string" ? JSON.parse(data) : data;
				} catch (error) {
					console.log(error);
					return;
				}

				room = theme[data["roomTheme"]].find((element) => element.roomName == data["roomName"]);
				if (room != undefined) room.addUser(this);
			})
			.on("kickUser", (userName) => {
				user = this.room.users.find((element) => element.name == userName);
				if (this.room.host == this && user != undefined) {
					this.room.deleteUser(user, true);
				}
			})
			.on("userLeft", () => {
				if (this.room != null) {
					this.room.deleteUser(this, false);
				}
			})
			.on("message", (message) => {
				if (this.room == null) return;
				message.trim();
				if (message == "") return;

				this.room.resetTimer();
				io
					.in(this.room.roomName)
					.emit("message", { message: message, userName: this.name, color: this.nameColor });
			})
			.on("disconnect", () => {
				if (this.room) {
					this.room.deleteUser(this, false);
				}
				if (this.name != "Anonymous") {
					namesTaken.splice(namesTaken.indexOf(this.name), 1);
				}
			})
			.on("changeName", (name) => {
				if (namesTaken.includes(name)) {
					socket.emit("nameTaken");
					return;
				}
				if (data != "Anonymous") namesTaken.splice(namesTaken.indexOf(this.name), 1);

				this.name = name;

				if (data != "Anonymous") {
					namesTaken.push(data);
				}
			});
	};

	this.roomLeft = () => {
		this.room = null;
		this.socket.emit("roomLeft");
	};

	this.roomJoined = (room) => {
		this.room = room;
		this.socket.emit("roomJoined", {
			roomName: room.name,
			hostName: this.room.host.name,
			userCount: this.room.users.length
		});
	};

	configureListener();
}

//Server stuff

server.listen(PORT, HOST, () => {
	console.log(`Server is listening on ip ${HOST} and on port ${PORT}...`);
});

//Static file

app.use(express.static("./public"));

//Routes
app.get("/subjects", (req, res) => {
	res.json(getSubjectsInfo());
});

app.get("/subject/:subjectName", (req, res) => {
	if (!hasSubject(req.params.subjectName)) {
		res.status(400).json({
			error: "Unknown subject"
		})
	} else {
		res.status(200).json(getRoomsInfo(req.params.subjectName))
	}
}) 

app.get

//Socket event
io.on("connection", (socket) => {
	console.log(`Socket : ${socket.id} has connected to the server`);
	socket.on("name", (data) => {
		data.trim();
		if (namesTaken.includes(data)) {
			socket.emit("nameTaken");
			return;
		}

		user = new User(data, socket);
		if (data != "Anonymous") {
			namesTaken.push(data);
		}
		console.log(`User "${user.name}" created`);
	});
	socket.on("disconnect", () => {
		console.log(`Socket : ${socket.id} has disconnected from the server`);
	});
});


function getSubjectsInfo() {
	var datas = [];
	var themes = Object.keys(theme);

	for (var i = 0; i < themes.length; i++) {
		datas.push({
			"subjectName": themes[i],
			"userCount": theme[themes[i]].reduce((acc, cur) => {
				return acc + cur.users.length;
			}, 0)
		});
	}
	return datas;
}

function getRoomsInfo(subject) {

	const datas = []

	for (var i = 0; i < theme[subject].length; i++) {
		const room = theme[subject][i]

		datas.push({
			"roomName": room.roomName,
			"userCount": room.users.length
		})
	}
	
	return datas
}


const keys = Object.keys(theme)

function hasSubject(subject) {
	return keys.includes(subject)
}

function countDownRoomLifeTime() {
	for (key of Object.keys(theme)) {
		for (let i = 0; i < theme[key].length; i++) {
			theme[key][i].tickTimer();
		}
	}
}

setInterval(countDownRoomLifeTime, 1000);
