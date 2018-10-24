const nodemailer = require('nodemailer')
const NOOP = ()=> {}
const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS

const host = process.env.SMTP_SERVER_ADDRESS

const transporter = host? nodemailer.createTransport({
	host,
	port: process.env.SMTP_SERVER_PORT,
	secure: true,
	auth: {
		user: EMAIL_ADDRESS,
		pass: process.env.EMAIL_PASSWORD
	},
	dkim: {
		domainName: process.env.DOMAIN_ADDRESS,
		keySelector: process.env.DKIM_SELECTOR,
		privateKey: process.env.DKIM_KEY.replace(/\\n/g, '\n')
	}
}) : nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: EMAIL_ADDRESS,
		pass: process.env.EMAIL_PASSWORD
	}
})

module.exports = {
	transporter,
	sendRegistrationEmail: function ({ to, from, href = '' }, cb = NOOP) {
		const mailOptions = {
			from: from || EMAIL_ADDRESS,
			to,
			subject: 'FiveHammer: Account Verification',
			html: `
			<center><h1>FIVEHAMMER</h1></center>
			<br>
				<center>
					<p>
						Hi! It seems like you have registered a new account on FiveHammer,
						Please click <a href="${ href }">here</a> to verify your account and
						start using it!
					</p>
				</center>`
		}

		transporter.sendMail(mailOptions, cb)
	}
}