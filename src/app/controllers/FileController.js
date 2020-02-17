class FileController {
  async store(req, res) {
    return res.json({ hello: 'World' });
  }
}

export default new FileController();
