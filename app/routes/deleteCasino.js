
const express = require('express');
const {MongoClient} = require('mongodb');
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
// const saltKey = process.env.saltKey;

async function deleteStatementTras(req, res) {
  const client = new MongoClient(DBHost, { useUnifiedTopology: true });
  await client.connect();
  const casinoCalls = client.db(`${DBNAME}`).collection("casinocalls");
  const deposits = client.db(`${DBNAME}`).collection("deposits");

  try {
    const { transaction_id, user_id } = req.body;

    // Delete records from casinocalls collection
    const casinoCallsResult = await casinoCalls.deleteMany({
      transaction_id: transaction_id,
      user_name: `user_${user_id}`,
    });

    // Delete records from deposits collection
    const depositsResult = await deposits.deleteMany({
      betId: transaction_id,
      userId: user_id,
    });

    let message = "";

    if (casinoCallsResult.deletedCount > 0) {
      message += `${casinoCallsResult.deletedCount} record(s) deleted from casinocalls collection. `;
    }

    if (depositsResult.deletedCount > 0) {
      message += `${depositsResult.deletedCount} record(s) deleted from deposits collection. `;
    }

    if (casinoCallsResult.deletedCount === 0 || depositsResult.deletedCount === 0) {
      return res.status(404).json({ error: "No records found for deletion" });
    }

    res.status(200).json({
      message: message.trim(),
      casinocallsDeletedCount: casinoCallsResult.deletedCount,
      depositsDeletedCount: depositsResult.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting records:", error);
    res.status(500).json({ error: "An error occurred while deleting records" });
  } finally {
    await client.close();
  }
}