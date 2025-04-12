import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asynchandler.js"
import {Video} from "../models/video.model.js"

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    if(!name || !description) {
        throw new ApiError(400,"All fields are required")
    }

    const playlist = await Playlist.create({
        title: title,
        description: description,
        videos: [],
        owner: req.user?._id
    })
    if(!playlist) {
        throw new ApiError(500,"Playlist can't be created")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,playlist,"Playlist created successfully")
    )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    if(!userId && !isValidObjectId(userId)) {
        throw new ApiError(400,"Invalid user ID")
    }

    const userPlaylists = await Playlist.find({
        owner: userId
    })
    if(!userPlaylists.length) {
        throw new ApiError(404,"No playlists found for the user")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,userPlaylists,"User's playlists fetched successfully")
    )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400,"Invalid playlist Id")
    }

    const playlist = await Playlist.findById(playlistId)
    if(!playlist) {
        throw new ApiError(404,"No playlist found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,playlist,"Playlist fetched for the playlist id")
    )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400,"Invalid playlist or video ID")
    }

    const video = await Video.findById(videoId)
    if(!video) {
        throw new ApiError(404,"Video not found")
    }

    const playlist = await Playlist.findById(playlistId)
    if(!playlist) {
        throw new ApiError(404,"Playlist not found")
    }

    if(!playlist.videos.includes(video._id)) {
        const videoAddedToPlaylist = await Playlist.findByIdAndUpdate(
            playlistId,
            {
                $push: {
                    videos: video
                }
            },
            {new: true}
        )
        if(!videoAddedToPlaylist) {
            throw new ApiError(500,"Video couldnot be added to playlist")
        }
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,playlist,"video added to playlist successfully")
    )
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!videoId || !playlistId) {
        throw new ApiError(400,"Invalid video or playlist ID")
    }

    const video = await Video.findById(videoId)
    if(!video) {
        throw new ApiError(404,"Video not found")
    }

    const playlist = await Playlist.findById(playlistId)
    if(!playlist) {
        throw new ApiError(404,"Playlist not found")
    }

    if(!playlist.videos.includes(video)) {
        throw new ApiError(404,"Video not found in the playlist")
    } else {
        const deletedVideo = await Playlist.findByIdAndDelete(
            playlistId,
            {
                $pop: {
                    videos: video
                }
            }
        )
    }
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}