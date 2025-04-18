import { axiosInstance } from ".";

// get transaction summary for a user
export const GetTransactionSummary = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/reports/get-transaction-summary",
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

// get monthly transaction data for charts
export const GetMonthlyData = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/reports/get-monthly-data",
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

// get transaction category summary
export const GetCategorySummary = async (payload) => {
  try {
    const { data } = await axiosInstance.post(
      "/api/reports/get-category-summary",
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
