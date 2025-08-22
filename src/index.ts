import amqp from "amqplib";

import { config } from "./config";
import logger from "./logger";
import TaskProcessor from "./TaskProcessor";
import { jobTaskSchema } from "./types";

async function startWorker() {
    let connection: amqp.ChannelModel | null = null;
    let channel: amqp.Channel;

    try {
        connection = await amqp.connect(config.rabbit_url);
        channel = await connection.createChannel();

        // Объявляем ту же очередь, чтобы убедиться, что она существует
        await channel.assertQueue(config.queue_name, { durable: true });

        channel.prefetch(1); // воркер берёт не более задачи за раз
        logger.info("Waiting for job...");

        
        // разгребаем очередь
        channel.consume(
            config.queue_name,
            async (msg) => {
                console.log("msg!")
                if (msg !== null) {
                    try {
                        const task = jobTaskSchema.parse(JSON.parse(msg.content.toString()));
                        const taskProcessor = new TaskProcessor(task);
                        
                        await taskProcessor.processTask();

                        logger.debug("set ack");
                        channel.ack(msg); // подтверждение, что сообщение получено (задача выполнена!)
                    } catch (error) {
                        logger.error(error, "Error while processing job");
                    }
                }
            },
            {
                noAck: false, // важно, чтобы отправлять подтверждения вручную
            },
        );

        channel.on('error', (error) => {
            logger.error('Channel error:', error);
        });
        
        channel.on('close', () => {
            logger.info('Channel closed.');
        });

    } catch (error) {
        logger.fatal(error, "unknown error");
        if (connection) {
            await connection.close();
        }
        process.exit(1);
    }

    async function gracefulShutdown() {
        logger.info('Shutting down gracefully...');
        try {
            if (channel) {
                await channel.close();
                logger.info('RabbitMQ channel closed.');
            }
            if (connection) {
                await connection.close();
                logger.info('RabbitMQ connection closed.');
            }
        } catch (error) {
            logger.error(error, 'Error during shutdown:');
        } finally {
            process.exit(0);
        }
    }

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
}

startWorker();
