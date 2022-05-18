const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;

// Middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Doctors Portal Client Site Deploy Heroku!')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorsprotal.dzwyi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyToken(req, res, next) {
    const authHeaders = req.headers.authorization;
    if (!authHeaders) {
        return res.status(401).send({ message: 'Unauthorize Access' })
    }
    const token = authHeaders.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next()
    });
}

const options = {
    auth: {
        api_key: process.env.EMAIL_SENDER_API
    }
}

const emailClient = nodemailer.createTransport(sgTransport(options));

function sendEmailUser(booking) {

    const { treatment, patientName, patient, date, slot } = booking;
    const email = {
        from: process.env.EMAIL_SENDER_USER,
        to: patient,
        subject: `Your Appointment ${treatment} is on ${date} at ${slot} is confirmed`,
        text: `Your Appointment ${treatment} is on ${date} at ${slot} is confirmed`,
        html: `
        <div>
        <h1>Hello ${patientName},</h1>
        <h3>Your Appointment ${treatment} is confirmed</h3>
        <h3>Our Address</h3>
        <p>Barishal,Bangladesh</p>
        </div>
        `,

    };

    emailClient.sendMail(email, function (err, info) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Message sent:', info);
        }
    });

}

async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db('doctorsPortal').collection('services')
        const bookingCollection = client.db('doctorsPortal').collection('bookings')
        const userCollection = client.db('doctorsPortal').collection('users')
        const doctorCollection = client.db('doctorsPortal').collection('doctors')

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
        }

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const services = await cursor.toArray();
            res.send(services);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, exists })
            }
            const result = await bookingCollection.insertOne(booking);
            sendEmailUser(booking);
            console.log('Send Email');
            return res.send({ success: true, result })
        })

        app.post('/doctor', verifyToken, verifyAdmin, async (req, res) => {
            const user = req.body;
            const doctors = await doctorCollection.insertOne(user)
            res.send(doctors)
        })

        app.get('/doctors', verifyToken, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors)
        })

        app.delete('/doctors/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const doctors = await doctorCollection.deleteOne(filter);
            res.send(doctors);
        })

        app.get('/booking', verifyToken, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded?.email;
            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                return res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ result, token });
        })

        app.put('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = { $set: { role: 'admin' } };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/users', verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result);
        })

        app.get('/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1: get all services
            const services = await serviceCollection.find().toArray()

            // step 2: get the booking of the day
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()

            // step 3: for each service
            services.forEach(service => {
                // step 4: find booking for that service
                const serviceBooking = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service booking
                const bookedSlots = serviceBooking.map(book => book.slot)
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                // step 7: set available to slots to make it easier
                service.slots = available;
            })

            res.send(services);
        })
    }
    finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Doctors Portal Server Site listening on port ${port}`)
})