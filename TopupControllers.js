import { prisma } from "../../config/PrismaConfig.js";
import {
  ErrorMessage,
  SuccesMessage,
} from "../../middleware/HandlingMessage.js";
import crypto from "crypto";
import axios from "axios";

//global Variabel Tripay
const { API_TRIPAY, PRIVATE_TRIPAY, MERCHANT_TRIPAY } = process.env;

export const TopUp = async (req, res) => {
  const { amount, paymentMethod } = req.body;
  if (!amount || !paymentMethod) {
    return ErrorMessage(res, 400, "Semua field wajib di isi");
  }
  //buat mercahnt_ref
  const merchant_ref = `INV-${Date.now()}`;
  // buat expired time dalam unix timestamp (detik), expired 15 menit dari sekarang
  const expiredTime = parseInt(Math.floor(Date.now() / 1000) + 15 * 60);

  //parse amount
  const amount2 = parseInt(amount);
  if (amount2 < 10000) {
    return ErrorMessage(res, 400, "Minimal top up adalah 10.000");
  }
  //buat signature
  const signature = crypto
    .createHmac("sha256", PRIVATE_TRIPAY)
    .update(MERCHANT_TRIPAY + merchant_ref + amount.toString())
    .digest("hex");

  //cari usersId dari verifyAuth yang sudah login
  const userId = await prisma.users.findUnique({
    where: { id: req.user.id },
  });
  const payload = {
    method: paymentMethod,
    merchant_ref,
    amount: amount2,
    customer_name: userId.username,
    customer_email: userId.email,
    order_items: [
      {
        sku: "TOPUP SALDO",
        name: "TOP-UP SALDO",
        price: amount2,
        quantity: 1,
      },
    ],
    return_url: "http://localhost:5000/api/v1/payment/succes",
    expired_time: expiredTime,
    signature: signature,
  };

  try {
    //create transaction
    const response = await axios.post(
      `https://tripay.co.id/api-sandbox/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${API_TRIPAY}`,
        },
      }
    );

    //create transaction simpan ke database
    await prisma.topup.create({
      data: {
        amount: amount2,
        reference: response.data.data.reference,
        paymentMethod,
        usersId: req.user.id,
        status: "Pending",
      },
    });
    SuccesMessage(res, 201, response.data.data, "Berhasil top up");
  } catch (error) {
    console.log(`Ada yang error nih di top up  ${error.message}`);
  }
};

//callback tripay
export const Callback = async (req, res) => {
  const callbackSignature = req.headers["x-callback-signature"];
  const CallbackEvent = req.headers["x-callback-event"];
  const json = req.body;
  const signature = crypto
    .createHmac("sha256", PRIVATE_TRIPAY)
    .update(JSON.stringify(json))
    .digest("hex");

  //cekapakah signature bener bener sama
  if (signature !== callbackSignature) {
    return ErrorMessage(res, 400, "Invalid signature");
  }

  //validasi eventStatus
  if (CallbackEvent !== "payment_status") {
    return ErrorMessage(res, 400, "Invalid payment_status");
  }

  const reference = json.reference;
  const status = json.status;

  try {
    //buat kondisi menggnakan switch
    switch (status) {
      case "PAID":
        //update status
        const TopUp = await prisma.topup.update({
          where: { reference: reference },
          data: {
            status: "Success",
          },
        });
        await prisma.users.update({
          where: { id: TopUp.usersId },
          data: {
            saldo: { increment: TopUp.amount },
          },
        });
        break;

      case "FAILED":
        //update status
        await prisma.topup.update({
          where: { reference: reference },
          data: {
            status: "Failed",
          },
        });
        break;
      case "EXPIRED":
        //update status
        await prisma.topup.update({
          where: { reference: reference },
          data: {
            status: "Expired",
          },
        });
        break;
    }

    SuccesMessage(res, 200, status, "Callback success");
  } catch (error) {
    console.log(`Error callback ${error}`);
  }
};
