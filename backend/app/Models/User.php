<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'fname',
        'mname',
        'lname',
        'yearAndClass',
        'program',
        'student_number',
        'name',
        'email',
        'username',
        'password',
        'archived',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function toArray()
    {
        $attributes = parent::toArray();
        
        // Add fullname for frontend compatibility
        $attributes['fullname'] = $this->name ?: ($this->fname . ' ' . $this->lname);
        
        // Map role from relationship
        $role = $this->roles->first();
        
        if ($role) {
            $attributes['role_id'] = $role->id;
            $attributes['role'] = $role->name;
            $attributes['roles'] = $role->name; // Add plural version for frontend compatibility
        } else {
            // Fallback or default
            $attributes['role'] = 'Student';
            $attributes['roles'] = 'Student';
            $attributes['role_id'] = 3;
        }

        // Map student fields for frontend compatibility
        // Handle yearAndClass format (e.g., "4-Alpha" or "4 Alpha")
        if ($this->yearAndClass) {
            $parts = preg_split('/[-\s]/', $this->yearAndClass, 2);
            $attributes['year_level'] = $parts[0] ?? '';
            $attributes['class_name'] = $parts[1] ?? '';
        } else {
            $attributes['year_level'] = '';
            $attributes['class_name'] = '';
        }
        
        // Map student_number to student_number for frontend
        $attributes['student_number'] = $this->student_number ?: '';
        
        // Ensure program_id is available for frontend
        if ($this->program) {
            // Map program name to ID
            $programMap = ['BSMT' => '6', 'BSMarE' => '5'];
            $attributes['program_id'] = $programMap[$this->program] ?? '';
        } else {
            $attributes['program_id'] = '';
        }

        return $attributes;
    }
}
