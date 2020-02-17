import { Router } from 'express';
import multer from 'multer';
import FileController from './app/controllers/FileController';
import SessionController from './app/controllers/SessionController';
import UserController from './app/controllers/UserController';
import authMiddleware from './app/middlewares/auth';
import multerConfig from './config/multer';

const routes = new Router();
const upload = multer(multerConfig);

routes.post('/users', UserController.store);
routes.post('/sessions', SessionController.store);

routes.use(authMiddleware);

routes.post('/files', FileController.store);
routes.put('/users', UserController.update);
routes.get('/', (req, res) => res.json({ hello: 'World' }));

routes.post('/files', upload.single('file'), (req, res) => {
  return res.json({ hello: 'World' });
});

export default routes;
