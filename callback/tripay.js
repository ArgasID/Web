const express = require('express');
const crypto = require('crypto');
const router = express.Router();

router.post('/', express.json(), (req, res) => {
  const signature = req.headers['x-signature'];
  const expectedSignature = crypto.createHmac('sha256', global.qrConfig.tripay.privateKey)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(403).send('Invalid signature');
  }

  const { merchant_ref, status } = req.body;

  if (status === 'PAID') {
    console.log(`Pembayaran sukses untuk order ${merchant_ref}`);
    // TODO: Tambahkan logika seperti memberi rank ke pemain, update status pembayaran, dll.
  } else {
    console.log(`Status pembayaran ${status} untuk order ${merchant_ref}`);
  }

  res.status(200).send('Callback diterima');
});

module.exports = router;