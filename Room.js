function Room(host, name) {
	this.afkTime = 1800
	this.name = name
	this.users = []
	this.host = host

	this.addUser = (user) => {
		if (this.users.includes(user)) return
		this.users.push(users)
	}
}

module.exports = Room
