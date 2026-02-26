<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends Model
{
    protected $fillable = [
    'text',
    'status',
    'remarks',
    'question_type_id',
    'course_id',
    'learning_outcome_id',
    'cognitive_level_id',
    'created_by',
    'options',
    'correct_answer_index',
    'correct_answer',
    'answers',
    'pairs',
    'points',
    'program'
];

    
    protected $casts = [
        'options' => 'array',
        'answers' => 'array',
        'pairs' => 'array'
    ];
    
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
