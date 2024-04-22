import { axiosInstance } from ".";

// verify receiver account
export const VerifyAccount = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/transactions/verify-account",
      payload
    );

    return data;
  } catch (error) {
    return error.response.data;
  }
};

// transfer money
export const TransferMoney = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/transactions/transfer-money",
      payload
    );
    
    return data;
  } catch (error) {
    return error.response.data;
  }
};

// get all transactions for a user
export const GetTransactionsOfUser = async () => {
  try {

    const { data } = await axiosInstance.post("/api/transactions/get-all-transactions-by-user");

    return data;
  } 
  catch (error) {
    return error.response.data;
  }
}

// deposit money using stripe
export const DepositMoney = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/transactions/deposit-money", payload);

    return data;
  } catch (error) {
    return error.response.data;
  }
}
