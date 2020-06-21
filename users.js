const colors = require("./colors.js")
const { indexOf } = require("./colors.js")
function User(name) {
	this.name = name
	this.room = null
	this.color = colors[Math.round(Math.random() * (colors.length - 1))]
	this.socket = null

	this.configureListeners = () => {
		this.socket
			.on("message", (message) => {
				message = typeof message != "string" ? message.toString() : message
				message.trim()
				if (this.room != null) this.socket.to(this.room.name).emit("message", message)
			})
			.on("disconnect", () => {})
	}
}

module.exports = User
