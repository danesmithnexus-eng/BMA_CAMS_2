<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('roles');
        
        // Filter by archived status
        if ($request->has('archived')) {
            $query->where('archived', $request->boolean('archived'));
        } else {
            // Default: show only non-archived users
            $query->where('archived', false);
        }
        
        $users = $query->get()->map(function ($user) {
            $data = $user->toArray();
            
            // Also add student data as nested object for compatibility
            $data['student'] = [
                'student_number' => $data['student_number'] ?? '',
                'class_name' => $data['class_name'] ?? '',
                'year_level' => $data['year_level'] ?? '',
                'program_id' => $data['program_id'] ?? ''
            ];
            
            return $data;
        });
        
        return $users;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fname' => 'required|string|max:255',
            'lname' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'username' => 'required|string|max:50|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|integer',
            'mname' => 'nullable|string|max:255',
            'year_level' => 'nullable|string|max:255',
            'class_name' => 'nullable|string|max:255',
            'program_id' => 'nullable|string|max:255',
            'student_number' => 'nullable|string|max:255',
            'yearAndClass' => 'nullable|string|max:255',
        ]);

        // Build yearAndClass from year_level and class_name if provided
        $yearAndClass = $validated['yearAndClass'] ?? null;
        if (!$yearAndClass && ($validated['year_level'] || $validated['class_name'])) {
            $year = $validated['year_level'] ?? '';
            $class = $validated['class_name'] ?? '';
            $yearAndClass = $year && $class ? "$year-$class" : ($year || $class);
        }

        // Map program_id to program name
        $program = null;
        if (isset($validated['program_id']) && $validated['program_id'] !== '') {
            $programMap = ['6' => 'BSMT', '5' => 'BSMarE'];
            $program = $programMap[$validated['program_id']] ?? null;
        }

        $user = User::create([
            'fname' => $validated['fname'],
            'lname' => $validated['lname'],
            'mname' => $validated['mname'] ?? null,
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'name' => $validated['fname'] . ' ' . $validated['lname'],
            'yearAndClass' => $yearAndClass,
            'program' => $program,
            'student_number' => $validated['student_number'] ?? null,
        ]);

        $user->roles()->attach($validated['role']);

        return response()->json($user->load('roles'), 201);
    }

    public function show(User $user)
    {
        $data = $user->load('roles')->toArray();
        
        // Also add student data as nested object for compatibility
        $data['student'] = [
            'student_number' => $data['student_number'] ?? '',
            'class_name' => $data['class_name'] ?? '',
            'year_level' => $data['year_level'] ?? '',
            'program_id' => $data['program_id'] ?? ''
        ];
        
        return $data;
    }

    public function update(Request $request, User $user)
    {
        // Debug: Log all incoming request data
        Log::info('Update user request data:', $request->all());
        Log::info('User ID being updated: ' . $user->id);
        
        // Check if student_number is being sent and log it
        if ($request->has('student_number')) {
            Log::info('Student number received: ' . $request->input('student_number'));
        }
        
        // Validate only the fields that are present in the request
        $rules = [];
        
        if ($request->has('fname')) {
            $rules['fname'] = 'required|string|max:255';
        }
        if ($request->has('lname')) {
            $rules['lname'] = 'required|string|max:255';
        }
        if ($request->has('email')) {
            $rules['email'] = 'required|string|email|max:255|unique:users,email,' . $user->id;
        }
        if ($request->has('username')) {
            $rules['username'] = 'required|string|max:50|unique:users,username,' . $user->id;
        }
        if ($request->has('password')) {
            $rules['password'] = 'nullable|string|min:8';
        }
        if ($request->has('role')) {
            $rules['role'] = 'required|integer';
        }
        
        // Student fields - always allow these (NO unique constraint)
        $rules['mname'] = 'nullable|string|max:255';
        $rules['year_level'] = 'nullable|string|max:255';
        $rules['class_name'] = 'nullable|string|max:255';
        $rules['program_id'] = 'nullable|string|max:255';
        $rules['student_number'] = 'nullable|string|max:255';
        
        Log::info('Validation rules:', $rules);
        
        try {
            $validated = $request->validate($rules);
            Log::info('Validation passed, validated data:', $validated);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation failed:', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
                'debug_rules' => $rules
            ], 422);
        }

        if (isset($validated['password']) && $validated['password']) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        if (isset($validated['fname']) || isset($validated['lname'])) {
            $fname = $validated['fname'] ?? $user->fname;
            $lname = $validated['lname'] ?? $user->lname;
            $validated['name'] = $fname . ' ' . $lname;
        }

        // Build yearAndClass from year_level and class_name if provided
        if (isset($validated['year_level']) || isset($validated['class_name'])) {
            // Get existing year and class from current yearAndClass if available
            $existingYear = '';
            $existingClass = '';
            if ($user->yearAndClass) {
                $parts = preg_split('/[-\s]/', $user->yearAndClass, 2);
                $existingYear = $parts[0] ?? '';
                $existingClass = $parts[1] ?? '';
            }
            $year = $validated['year_level'] ?? $existingYear;
            $class = $validated['class_name'] ?? $existingClass;
            $validated['yearAndClass'] = $year && $class ? "$year-$class" : ($year || $class);
        }

        // Map program_id to program name
        if (isset($validated['program_id']) && $validated['program_id'] !== '') {
            $programMap = ['6' => 'BSMT', '5' => 'BSMarE'];
            $validated['program'] = $programMap[$validated['program_id']] ?? null;
        }

        // Map student_number to student_number only if it's different from current
        if (isset($validated['student_number'])) {
            // Only update if the value is actually different
            if ($validated['student_number'] !== $user->student_number) {
                $validated['student_number'] = $validated['student_number'];
            } else {
                // Remove from validated to avoid unnecessary update
                unset($validated['student_number']);
            }
        }

        // Remove frontend-only fields that don't exist in DB
        unset($validated['year_level']);
        unset($validated['class_name']);
        unset($validated['program_id']);
        unset($validated['student_number']);

        try {
            $user->update($validated);

            if (isset($validated['role'])) {
                $user->roles()->sync([$validated['role']]);
            }

            return response()->json($user->load('roles'));
        } catch (\Illuminate\Database\QueryException $e) {
            Log::error('Database error during update:', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Database error: ' . $e->getMessage(),
                'errors' => ['database' => [$e->getMessage()]]
            ], 422);
        }
    }

    public function destroy(User $user)
    {
        // Archive the user instead of deleting
        $user->update(['archived' => true]);
        return response()->json(['message' => 'User archived successfully']);
    }

    public function restore(User $user)
    {
        $user->update(['archived' => false]);
        return response()->json(['message' => 'User restored successfully']);
    }

    public function archived()
    {
        $users = User::with('roles')->where('archived', true)->get()->map(function ($user) {
            $data = $user->toArray();
            
            // Also add student data as nested object for compatibility
            $data['student'] = [
                'student_number' => $data['student_number'] ?? '',
                'class_name' => $data['class_name'] ?? '',
                'year_level' => $data['year_level'] ?? '',
                'program_id' => $data['program_id'] ?? ''
            ];
            
            return $data;
        });
        
        return $users;
    }
}
