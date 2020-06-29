function Room(host, name) {
	this.afkTime = 1800
	this.name = name
	this.users = []
	this.host = host

	if (this.users.includes(host)) {
		return
	} else {
		this.users.push(host)
		user.socket.join(this.name)
	}

	this.addUser = (user) => {
		if (this.users.includes(user)) return
		this.users.push(user)

		user.socket.join(this.name)
	}
}

module.exports = Room
