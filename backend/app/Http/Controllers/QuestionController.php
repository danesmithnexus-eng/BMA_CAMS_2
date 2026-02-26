<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Question;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class QuestionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $questions = Question::with('course')->get();
        
        // Group questions by course
        $groupedQuestions = $questions->groupBy('course_id')->map(function ($group, $courseId) {
            // Get course name from the relationship
            $courseName = $group->first()?->course?->name ?? 'Course ID: ' . $courseId;
            
            return [
                'course_id' => $courseId,
                'course_name' => $courseName,
                'questions' => $group->map(function ($question) {
                    // Add additional fields that frontend expects
                    return [
                        'id' => $question->id,
                        'text' => $question->text,
                        'status' => $question->status,
                        'remarks' => $question->remarks,
                        'question_type_id' => $question->question_type_id,
                        'cognitive_level_id' => $question->cognitive_level_id,
                        'question_type' => $this->getQuestionTypeName($question->question_type_id),
                        'course' => $question->course?->name ?? 'Course ID: ' . $question->course_id,
                        'learning_outcome' => $question->learning_outcome_id,
                        'cognitive_level' => $this->getCognitiveLevelName($question->cognitive_level_id),
                        'creator' => $question->created_by
                    ];
                })->toArray()
            ];
        })->values(); // Convert to indexed array
        
        return response()->json([
            'message' => 'Questions retrieved successfully',
            'data' => $groupedQuestions
        ]);
    }
    
    private function getQuestionTypeName($typeId)
    {
        $types = [
            1 => 'true-false',
            2 => 'multiple-choice',
            3 => 'matching-type',
            4 => 'identification',
            5 => 'enumeration'
        ];
        
        // Handle both numeric IDs and string types
        if (is_numeric($typeId)) {
            return $types[$typeId] ?? 'unknown';
        }
        
        return $typeId; // Return as is if it's already a string
    }
    
    private function getCognitiveLevelName($levelId)
    {
        $levels = [
            1 => 'Remembering',
            2 => 'Understanding',
            3 => 'Applying',
            4 => 'Analyzing',
            5 => 'Evaluating',
            6 => 'Creating'
        ];
        
        // Handle both numeric IDs and string types
        if (is_numeric($levelId)) {
            return $levels[$levelId] ?? 'Unknown';
        }
        
        return $levelId; // Return as is if it's already a string
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => ['nullable', Rule::in(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])],
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|integer',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'options' => 'nullable|array',
            'correct_answer_index' => 'nullable|integer',
            'correct_answer' => 'nullable|string',
            'answers' => 'nullable|array',
            'pairs' => 'nullable|array',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question = Question::create($validated);
        return response()->json($question, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return Question::findOrFail($id);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $question = Question::findOrFail($id);
        
        $validated = $request->validate([
            'text' => 'sometimes|required|string',
            'status' => ['nullable', Rule::in(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])],
            'remarks' => 'nullable|string',
            'question_type_id' => 'sometimes|required|string',
            'course_id' => 'nullable|integer',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'options' => 'nullable|array',
            'correct_answer_index' => 'nullable|integer',
            'correct_answer' => 'nullable|string',
            'answers' => 'nullable|array',
            'pairs' => 'nullable|array',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question->update($validated);
        return response()->json($question);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $question = Question::findOrFail($id);
        $question->delete();
        return response()->json(null, 204);
    }

    /**
     * Update question status.
     */
    public function updateStatus(Request $request, string $id)
    {
        $question = Question::findOrFail($id);
        
        $validated = $request->validate([
            'status' => ['required', Rule::in(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])],
            'remarks' => 'nullable|string'
        ]);

        $question->update($validated);
        return response()->json($question);
    }

    /**
     * Batch update question statuses.
     */
    public function batchUpdateStatus(Request $request)
    {
        $validated = $request->validate([
            'fromStatus' => ['required', Rule::in(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])],
            'toStatus' => ['required', Rule::in(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])]
        ]);

        Question::where('status', $validated['fromStatus'])
            ->update(['status' => $validated['toStatus']]);

        return response()->json(['message' => 'Statuses updated successfully']);
    }
}
