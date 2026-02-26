<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (Auth::attempt($credentials)) {
            $user = Auth::user();
            $token = $user->createToken('auth-token')->plainTextToken;
            
            // Return role as an array to match frontend expectation
            // User::toArray() now maps 'role' to string name
            $userArray = $user->toArray();
            $roles = [$userArray['role']]; 

            return response()->json([
                'user' => $userArray,
                'token' => $token,
                'roles' => $roles
            ]);
        }

        return response()->json(['message' => 'Invalid email or password.'], 401);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function verifyPassword(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user();

        if (Hash::check($request->password, $user->password)) {
            return response()->json(['verified' => true]);
        }

        return response()->json(['verified' => false, 'message' => 'Incorrect password.'], 401);
    }
}
