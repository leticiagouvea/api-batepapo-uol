import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
    await mongoClient.connect();
    console.log("MongoDB is connected!");
} catch (error) {
    console.log(error);
}

let db = mongoClient.db("batepapouol");
const collectionParticipants = db.collection("participants");

const schemaParticipant = joi.object({
    name: joi.string().required()
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const validation = schemaParticipant.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const error = validation.error.details.map(detail => detail.message);
        res.status(422).send(error);
        return;
    }

    try {
        const existingUser = await collectionParticipants.findOne({ name });

        if(existingUser) {
            res.status(409).send("Esse usuário já existe");
            return;
        }

        await collectionParticipants.insertOne({name, lastStatus: Date.now()});
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.listen(5000, () => {
    console.log("App is running in port: 5000");
});