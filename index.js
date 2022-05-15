const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
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

async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db('doctorsPortal').collection('services')
        const bookingCollection = client.db('doctorsPortal').collection('bookings')

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, booking })
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

            res.send(services)

        })
    }
    finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Doctors Portal Server Site listening on port ${port}`)
})