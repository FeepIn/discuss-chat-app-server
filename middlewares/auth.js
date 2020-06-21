const jwt = require("jsonwebtoken")

let auth = (token, secretKey) => {
	try {
		var verified = token ? jwt.verify(token, secretKey) : false
	} catch (error) {
		return false
	}

	return verified
}

module.exports = auth
