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
    res.send('Doctors Portal Client Site!')
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctorsprotal.dzwyi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {

    try {
        await client.connect();
        const serviceCollection = client.db('doctorsPortal').collection('services')

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
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