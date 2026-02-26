<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Question;

class AnswerController extends Controller
{
    /**
     * Display a listing of all questions.
     */
    public function index()
    {
        return Question::all();
    }

    /**
     * Display the specified question.
     */
    public function show(string $id)
    {
        return Question::findOrFail($id);
    }

    /**
     * Update the specified question.
     */
    public function update(Request $request, string $id)
    {
        $question = Question::findOrFail($id);
        
        $validated = $request->validate([
            'text' => 'sometimes|required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'sometimes|required|string',
            'course_id' => 'nullable|string',
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
     * Remove the specified question.
     */
    public function destroy(string $id)
    {
        $question = Question::findOrFail($id);
        $question->delete();
        return response()->json(null, 204);
    }

    /**
     * Store multiple questions in bulk.
     * This endpoint is used by:
     * POST /api/answers/bulk
     */
    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'questions' => 'required|array',
            'questions.*.text' => 'required|string',
            'questions.*.status' => 'nullable|string',
            'questions.*.remarks' => 'nullable|string',
            'questions.*.question_type_id' => 'required|string',
            'questions.*.course_id' => 'nullable|string',
            'questions.*.learning_outcome_id' => 'nullable|string',
            'questions.*.cognitive_level_id' => 'nullable|string',
            'questions.*.created_by' => 'nullable|string',
            'questions.*.options' => 'nullable|array',
            'questions.*.correct_answer_index' => 'nullable|integer',
            'questions.*.correct_answer' => 'nullable|string',
            'questions.*.answers' => 'nullable|array',
            'questions.*.pairs' => 'nullable|array',
            'questions.*.points' => 'nullable|integer',
            'questions.*.program' => 'nullable|string'
        ]);

        $created = [];
        foreach ($validated['questions'] as $questionData) {
            $question = Question::create($questionData);
            $created[] = $question;
        }

        return response()->json([
            'message' => 'Questions created successfully',
            'count' => count($created),
            'questions' => $created
        ], 201);
    }

    /**
     * Store True / False question answers.
     * This endpoint is used by:
     * POST /api/answers/true-false
     */
    public function storeTrueFalse(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|integer',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'correct_answer' => 'required|in:true,false,0,1',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        // Normalize correct_answer to boolean-like string
        if ($validated['correct_answer'] === '0') {
            $validated['correct_answer'] = 'false';
        }

        if ($validated['correct_answer'] === '1') {
            $validated['correct_answer'] = 'true';
        }

        // Save everything into questions table
        $question = Question::create($validated);

        return response()->json($question, 201);
    }

    /**
     * Store Multiple Choice question answers.
     * This endpoint is used by:
     * POST /api/answers/multiple-choice
     */
    public function storeMultipleChoice(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|string',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'options' => 'nullable|array',
            'correct_answer_index' => 'nullable|integer',
            'correct_answer' => 'nullable|string',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question = Question::create($validated);

        return response()->json($question, 201);
    }

    /**
     * Store Matching question answers.
     * This endpoint is used by:
     * POST /api/answers/matching
     */
    public function storeMatching(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|string',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'pairs' => 'nullable|array',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question = Question::create($validated);

        return response()->json($question, 201);
    }

    /**
     * Store Identification question answers.
     * This endpoint is used by:
     * POST /api/answers/identification
     */
    public function storeIdentification(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|string',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'answers' => 'nullable|array',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question = Question::create($validated);

        return response()->json($question, 201);
    }

    /**
     * Store Enumeration question answers.
     * This endpoint is used by:
     * POST /api/answers/enumeration
     */
    public function storeEnumeration(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string',
            'status' => 'nullable|string',
            'remarks' => 'nullable|string',
            'question_type_id' => 'required|string',
            'course_id' => 'nullable|string',
            'learning_outcome_id' => 'nullable|string',
            'cognitive_level_id' => 'nullable|string',
            'created_by' => 'nullable|string',
            'answers' => 'nullable|array',
            'points' => 'nullable|integer',
            'program' => 'nullable|string'
        ]);

        $question = Question::create($validated);

        return response()->json($question, 201);
    }
}
