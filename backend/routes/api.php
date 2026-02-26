<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\QuestionController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/verify-password', [AuthController::class, 'verifyPassword']);
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    // Custom routes must come BEFORE apiResource
    Route::get('/users/archived/list', [UserController::class, 'archived']);
    Route::post('/users/{user}/restore', [UserController::class, 'restore']);
    Route::apiResource('users', UserController::class);
    
    // Question routes
    Route::apiResource('questions', QuestionController::class);
    Route::post('/questions/{id}/update-status', [QuestionController::class, 'updateStatus']);
    Route::post('/questions/batch-update-status', [QuestionController::class, 'batchUpdateStatus']);
});
