import express from 'express';

export interface IServer {
    app: express.Application,
    isDbConnected: boolean

}
