import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
    await mongoClient.connect();
    console.log("MongoDB is connected!");
} catch (error) {
    console.log(error);
}

let db = mongoClient.db("batepapouol");

const collectionParticipants = db.collection("participants");

const collectionMessages = db.collection("messages");

let date;

setInterval(() => {
    date = dayjs().locale("pt-br").format("HH:mm:ss");
}, 1000);

// PARTICIPANTS ROUTES

const schemaParticipant = joi.object({
    name: joi.string().required()
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const validation = schemaParticipant.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const error = validation.error.details.map(detail => detail.message);
        return res.status(422).send(error);
    }

    try {
        const existingUser = await collectionParticipants.findOne({ name });

        if(existingUser) {
            return res.status(409).send("Esse usuário já existe");
        }

        await collectionParticipants.insertOne({
            name, 
            lastStatus: Date.now()
        });

        await collectionMessages.insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: date
        })
        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const userList = await collectionParticipants.find().toArray();
        res.send(userList);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

// MESSAGES ROUTES

const schemaMessages = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.valid("message", "private_message")
});

app.post("/messages", async (req, res) => {
    const { user } = req.headers;
    const { to, text, type } = req.body;
    
    const validation = schemaMessages.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const error = validation.error.details.map(detail => detail.message);
        return res.status(422).send(error);
    }

    try {
        const existingUser = await collectionParticipants.findOne({ name: user });

        if(!existingUser) {
            return res.status(422).send("Usuário inexistente");
        }

        await collectionMessages.insertOne({
            from: user,
            to,
            text,
            type,
            time: date
        });

        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;

    try {
        const listMessages = await collectionMessages.find().toArray();

        const filterMessages = listMessages.filter(value => 
            value.type === "message" || 
            value.type === "status" ||
            (value.type === "private_message" && value.from === user) || 
            (value.type === "private_message" && value.to === user));

        if(!limit) {
            return res.send(filterMessages);
        }

        res.send(filterMessages.slice(- limit));
        
    } catch (error) {
        res.sendStatus(500);
    }
});

app.delete("/messages/:idMessage", async (req, res) => {
    const { user } = req.headers;
    const { idMessage } = req.params;

    try {
        const existingUser = await collectionParticipants.findOne({ name: user });

        if(!existingUser) {
            return res.sendStatus(401);
        }

        const existingIdMessage = await collectionMessages.findOne({
            _id: ObjectId(idMessage)
        });

        if(!existingIdMessage) {
            return res.sendStatus(404);
        }

        const result = await collectionMessages.deleteOne({
            _id: ObjectId(idMessage)
        });

        res.send(result);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

// STATUS ROUTES

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    const statusUpdate = {
        name: user,
        lastStatus: Date.now()
    }

    try {
        const existingUser = await collectionParticipants.findOne({ name: user });

        if(!existingUser) {
            return res.sendStatus(404);
        }

        await collectionParticipants.updateOne({name: user}, {$set: statusUpdate});

        res.sendStatus(200);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

setInterval(async () => {
    const time = Date.now();

    const userList = await collectionParticipants.find().toArray();

    const inactiveUser = userList.filter(value => (time - value.lastStatus) > 10000);

    if(inactiveUser.length > 0) {
        const inactiveUserOut = inactiveUser.map(value => ({
            from: value.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: date
        }));

        await collectionParticipants.deleteMany(inactiveUser.name);

        await collectionMessages.insertMany(inactiveUserOut);
    }
}, 15000);

app.listen(5000, () => {
    console.log("App is running in port: 5000");
});