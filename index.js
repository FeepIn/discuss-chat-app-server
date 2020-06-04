const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const PORT = process.env.PORT || 8080;
var namesTaken = [];
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
	addUser(host);
	console.log(`Room "${roomName}" has been created by "${host.name}"`);

	function addUser(user) {
		if (parent.users.includes(user)) {
			return;
		}
		parent.users.push(user);
		user.socket.join(parent.roomName);
		if (user.room == null) {
			user.roomJoined(parent);
			io.in(parent.roomName).emit("newUser", user.name);
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
			io.in(parent.roomName).emit("userKicked", user.name);
			user.socket.leave(parent.roomName);
			user.roomLeft();
			console.log(`User "${user.name}" has been kicked from room "${parent.roomName}"`);
		} else {
			parent.users.splice(parent.users.indexOf(user), 1);
			io.in(parent.roomName).emit("userLeft", user.name);
			user.socket.leave(parent.roomName);
			user.roomLeft();
			console.log(`User "${user.name}" has left room "${parent.roomName}"`);

			if (this.host == user && this.users.length > 0) {
				this.host = this.users[Math.random * this.users.length - 1];
				io.in(this.roomName).emit("newHost", this.host.name);
			}
		}

		if (this.users.length <= 0) {
			this.destroyRoom();
		}
	}
}

function User(name, socket) {
	this.name = name;
	this.socket = socket;
	this.room = null;
	this.nameColor = colors[Math.round(Math.random() * colors.length)];

	let configureListener = () => {
		this.socket
			.on("createRoom", (data) => {
				data = typeof data == "string" ? JSON.parse(data) : data;

				if (theme[data["roomTheme"]].some((element) => element.roomName == data["roomName"])) {
					this.socket.emit("roomNameTaken");
				} else {
					this.room = new Room(this, data["roomName"], data["roomTheme"]);
				}
			})
			.on("joinRoom", (data) => {
				data = typeof data == "string" ? JSON.parse(data) : data;

				theme[data["roomTheme"]].find((element) => element.roomName == data["roomName"]).addUser(this);
			})
			.on("kickUser", (userName) => {
				if (this.room.host == this) {
					this.room.deleteUser(this.room.users.find((element) => element.name == userName), true);
				}
			})
			.on("userLeft", () => {
				this.room.deleteUser(this, false);
			})
			.on("message", (message) => {
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

				namesTaken.splice(namesTaken.indexOf(this.name), 1);

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
		this.socket.emit("roomJoined", { roomName: room.name, hostName: this.room.host.name });
	};

	configureListener();
}

server.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}...`);
});

app.get("/rooms", (req, res) => {
	res.json(getCounts());
});

io.on("connection", (socket) => {
	console.log(`Socket : ${socket.id} has connected to the server`);
	socket.on("name", (data) => {
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
});

function getCounts() {
	var datas = {};
	var themes = Object.keys(theme);

	for (var i = 0; i < themes.length; i++) {
		datas[themes[i]] = {};
		datas[themes[i]].userCount = theme[themes[i]].reduce((acc, cur) => {
			return acc + cur.users.length;
		}, 0);
		datas[themes[i]].rooms = theme[themes[i]].map((val) => {
			return { roomName: val.roomName, userCount: val.users.length };
		});
	}

	return datas;
}

function countDownRoomLifeTime() {
	for (key of Object.keys(theme)) {
		for (let i = 0; i < theme[key].length; i++) {
			theme[key][i].tickTimer();
		}
	}
}

setInterval(countDownRoomLifeTime, 1000);
