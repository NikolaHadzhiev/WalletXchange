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
    if(!error.response) {
      return { message: "Server error" };
    }
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
    if(!error.response) {
      return { message: "Server error" };
    }
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
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
}

// deposit money using stripe
export const DepositMoney = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/transactions/deposit-money", payload);

    return data;
  } catch (error) {
    if(!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// verify deposit code
export const VerifyDepositCode = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/transactions/verify-deposit", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// PayPal deposit - create order (without sending verification code)
export const CreatePaypalOrder = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/paypal/create-paypal-order", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// PayPal deposit - request verification code
export const RequestPaypalVerificationCode = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/paypal/request-verification", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// PayPal deposit - verify code and capture payment
export const VerifyPaypalDeposit = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/paypal/verify-paypal", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// PayPal withdrawal - request code
export const RequestPaypalWithdrawal = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/paypal/withdraw-paypal", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};

// PayPal withdrawal - verify and process
export const VerifyPaypalWithdrawal = async (payload) => {
  try {
    const { data } = await axiosInstance.post("/api/paypal/verify-withdraw-paypal", payload);
    return data;
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};