interface ApiResponse {
    status: number;
    data?: Object | Object[];
    error?: {
        code?: number;
        msg: string;
    };
}

export default ApiResponse;
