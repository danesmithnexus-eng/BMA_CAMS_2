<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->text('text');
            $table->enum('status', ['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])->default('Draft');
            $table->text('remarks')->nullable();
            $table->string('question_type_id');
            $table->foreignId('course_id')->nullable()->constrained('courses')->onDelete('set null');
            $table->string('learning_outcome_id')->nullable();
            $table->string('cognitive_level_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->json('options')->nullable();
            $table->integer('correct_answer_index')->nullable();
            $table->string('correct_answer')->nullable();
            $table->json('answers')->nullable();
            $table->json('pairs')->nullable();
            $table->integer('points')->default(1);
            $table->string('program')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
