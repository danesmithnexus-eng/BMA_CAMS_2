<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Course extends Model
{
    protected $fillable = [
        'name',
        'program_id',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
    ];
    
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }
    
    public function questions()
    {
        return $this->hasMany(Question::class);
    }
}