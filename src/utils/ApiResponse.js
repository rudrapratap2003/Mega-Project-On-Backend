class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400 // i.e it will true if status code < 400 else it will show false (i.e if error code is genertaed)
    }
}
export {ApiResponse}