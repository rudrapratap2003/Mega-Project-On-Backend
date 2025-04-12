import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asynchandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };
    const videos = await Video.aggregatePaginate(
        Video.aggregate([
            {
                $match: {
                    title: {$regex:query, $options:"i"},
                    owner: mongoose.Types.ObjectId(userId)
                }
            },
            {
                $sort: {
                    [sortBy]: sortType === "asc"? 1 : -1
                }
            }
        ]),
        options
    )  

    if(!videos) {
        throw new ApiError(500,"Failed to fetch videos")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                totalPages: videos.totalPages,
                currentPage: videos.page,
                videos: videos.docs,
                totalDocs: videos.totalDocs,
                limit: videos.limit,
                total: videos.total
            }
        )
    )
})

const publishAVideo = asyncHandler(async (req,res) => {
    const {title, description} = req.body

    if(!title || !description) {
        throw new ApiError(400,"All fields are required")
    }

    const videoFileLocalpath = req.files?.videoFile[0]?.path
    if(!videoFileLocalpath) {
        throw new ApiError(400,"Video file is required")
    }
    const thumbnailLocalpath = req.files?.thumbnail[0]?.path
    if(!thumbnailLocalpath) {
        throw new ApiError(400,"Thumbnail is required")
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalpath)
    if(!videoFile) {
        throw new ApiError(400,"Video File is required")
    }
    const thumbnail = await uploadOnCloudinary(thumbnailLocalpath)
    if(!thumbnail) {
        throw new ApiError(400,"Thumbnail is required")
    }

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        views: 0,
        isPublished: true,
        owner: req.user?._id
    })

    if(!video) {
        throw new ApiError(500,"Failed to create video")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,video,"Video published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400,"Invalid request")
    }

    const fetchedVideo = Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        }, 
        // owner details
        {
            $lookup: {
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"videoOwner",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        // total likes of the video
        {
            $lookup: {
                from:"likes",
                localField:"video",
                foreignField:"_id",
                as:"totalLikes"
            }
        },
        {
            $addFields: {
                likeCount: {
                    $size:"$totalLikes"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$totalLikes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        }
    ])

    if(!fetchedVideo) {
        throw new ApiError(404,"Video not found")
    }

    // add fetched video to user's history
    const currentUser = User.findById(req.user?._id)
    if(!currentUser.watchHistory.includes(fetchedVideo[0]._id)) {
        const addVideoToUserHistory = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $push: {
                    watchHistory: fetchedVideo[0]._id
                }
            },
            {new: true}
        )
        if(!addVideoToUserHistory) {
            throw new ApiError(500,"Video could not add to watch history")
        }
    }

    // increase the views
    await Video.findByIdAndUpdate(
        fetchedVideo?._id,
        {
            $inc: {
                views: 1
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200,fetchedVideo,"Video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId) {
        throw new ApiError(400,"Video id is required")
    }

    const thumbnailLocalPath = req.files?.path
    const {title,description} = req.body

    if(!title || !description || !thumbnailLocalPath) {
        throw new ApiError(400,"All fields are required")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if(!thumbnail) {
        throw new ApiError(400,"Failed to upload thumbnail")
    }
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title,
                description: description,
                thumbnail: thumbnail.url
            }
        },
        {new: true}
    )
    
    if(!video) {
        throw new ApiError(500,"Failed to update video details")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,video,"Video details updated successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId ) {
        throw new ApiError(400,"Video id is required")
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId)

    return res
    .status(200)
    .json(
        new ApiResponse(200,deletedVideo,"Video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId) {
        throw new ApiError(400,"video id is required")
    }

    const video = await Video.findById(videoId)
    if(!video) {
        throw new ApiError(404,"Eroor! Video not found")
    }
    const toggledVideoStatus = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        {new: true}
    )
    if(!toggledVideoStatus) {
        throw new ApiError(400,"Error while updating the toggle status")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,toggledVideoStatus,"publish status toggled successfully")
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}