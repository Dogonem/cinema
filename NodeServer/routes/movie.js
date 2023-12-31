const express = require("express");
const router = express.Router();
const dbPool = require("../db");
const mysql = require("mysql2/promise"); // MySQL2 Promise 래퍼

//FilterR.vue에서 받은 장르값을 movies 테이블에 적용 시켜서 뽑아오고,뽑아온 영화 4개를 recommend테이블에 넣어주고, Recommend.vue로 보내주기
router.post("/filtervalues", async (request, res) => {
  try {
    const formData = request.body; // 클라이언트에서 보낸 데이터 받아오기
    const imageNames = [formData.e1, formData.e2]; //선택된 성별,연령대 이미지 파일명
    const selectGenres = formData.selectedGenres; // 선택한 장르 배열
    const emojiFileNames = [formData.e1, formData.e2, formData.e3, formData.e4]; // 이미지 파일명 4개
    console.log(formData);
    console.log(selectGenres);
    console.log(emojiFileNames);

    // 데이터베이스 연결 생성
    const connection = await dbPool.promise();

    // 1차적으로 첫 번째 장르를 이용한 필터링
    const firstGenreQuery = `
     SELECT MOVIE_NUM FROM movies WHERE
     GENRE1 = ? OR GENRE2 = ? OR GENRE3 = ? OR GENRE4 = ?
   `;
    const [firstFilteredMovies] = await connection.query(firstGenreQuery, [
      selectGenres[0],
      selectGenres[0],
      selectGenres[0],
      selectGenres[0],
    ]);

    // 2차적으로 두 번째 장르를 이용한 필터링
    const secondGenreQuery = `
      SELECT MOVIE_NUM FROM movies WHERE
      (GENRE1 = ? OR GENRE2 = ? OR GENRE3 = ? OR GENRE4 = ?) AND
      MOVIE_NUM IN (?)  ORDER BY RAND() LIMIT 4
    `;
    const [filteredMovies] = await connection.query(secondGenreQuery, [
      selectGenres[1],
      selectGenres[1],
      selectGenres[1],
      selectGenres[1],
      firstFilteredMovies.map((movie) => movie.MOVIE_NUM),
    ]);

    // 선택된 4개 영화의 무비넘들
    const selectedMovieNums = filteredMovies.map((movie) => movie.MOVIE_NUM);
    //json으로 변환
    const selectedMovieNumsJSON = JSON.stringify(selectedMovieNums);

    // 이미지 파일명 배열을 JSON 형식으로 변환
    const emojiFileNamesJSON = JSON.stringify(emojiFileNames);

    // recommend 테이블에 데이터 삽입
    const insertQuery = `
    INSERT INTO recommend (USER_NUM, MOVIE_NUM1, MOVIE_NUM2, MOVIE_NUM3, MOVIE_NUM4, EMOJI, MOVIE_NUM)
    VALUES (?, ?, ?, ?, ?, ?,?)
  `;
    const values = [
      formData.userNo,
      selectedMovieNums[0],
      selectedMovieNums[1],
      selectedMovieNums[2],
      selectedMovieNums[3],
      emojiFileNamesJSON,
      selectedMovieNumsJSON,
    ];

    // 이미지 파일명에 따라 컬럼 업데이트
    for (const imageName of imageNames) {
      switch (imageName) {
        case "woman.png":
          await connection.query(
            "UPDATE movies SET WOMAN = WOMAN + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        case "man.png":
          await connection.query(
            "UPDATE movies SET MAN = MAN + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        case "age1.png":
          await connection.query(
            "UPDATE movies SET TEENAGE = TEENAGE + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        case "age2.png":
          await connection.query(
            "UPDATE movies SET YOUTH = YOUTH + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        case "age3.png":
          await connection.query(
            "UPDATE movies SET SENIOR = SENIOR + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        case "age4.png":
          await connection.query(
            "UPDATE movies SET OLDER = OLDER + 1 WHERE MOVIE_NUM IN (?)",
            [selectedMovieNums]
          );
          break;
        default:
          // 이미지 파일명이 매칭되지 않을 경우 처리
          break;
      }
    }
    // 쿼리 실행 후 연결 닫기
    await connection.query(insertQuery, values);
  } catch (error) {
    console.error("무언가 문제가 있다", error);
    res.status(500).send({
      message: "무언가 문제가 있다",
    });
  }
});

//리뷰 저장로직
router.post("/writeComment", async (request, res) => {
  try {
    //모달창에서 데이터를 받기
    const formData = request.body; // 클라이언트에서 보낸 데이터 받기
    // console.log(formData);
    // console.log(formData.comment); // 리뷰 코멘트
    // console.log(formData.selectedMovie); //선택된 영화 정보
    // console.log(formData.userinfo); // 사용자 정보

    //리뷰테이블 쿼리생성
    const insertReviewQuery = `
      INSERT INTO review (USER_NICKNAME, MOVIE_NUM, REVIEW_COMMENT)
      VALUES (?, ?, ?)
    `;

    const values = [
      formData.userinfo, // 유저 닉네임
      formData.selectedMovie, // 영화 코드
      formData.comment, // 리뷰 코멘트
    ];
    // 데이터베이스 연결 생성
    const connection = await dbPool.promise();
    //데이터 넣기
    await connection.query(insertReviewQuery, values);
  } catch (error) {
    console.error("리뷰 저장 중 오류:", error);
    res.status(500).json({ message: "서버 오류로 리뷰 저장에 실패했습니다." });
  }
});

// 영화별 리뷰 정보 가져오기
router.get("/movieReviews", async (req, res) => {
  try {
    const movieId = req.params.movieId;
    console.log("영화번호", movieId);

    //movieId를 기반으로 리뷰 정보를 데이터베이스에서 가져오는 쿼리
    const reviews = await dbPool.query(
      "SELECT * FROM reviews WHERE MOVIE_NUM = ?"
    );
    console.log("리뷰정보", reviews);

    //가져온 리뷰 정보를 클라이언트로 응답
    res.status(200).json(reviews);
  } catch (error) {
    console.error("리뷰 정보를 가져오는 중 오류:", error);
    res
      .status(500)
      .json({ error: "리뷰 정보를 가져오는 중 오류가 발생했습니다." });
  }
});

//vue한테 사용자 성별,연령대 정보 받고 영화 필터링해서 응답해주기
router.post("/UserInfoRECmovie", async (req, res) => {
  const { gender, ageGroup } = req.body; //vue한테 받아온 성별,연령대 정보.
  // console.log("gender의 값", gender);
  // console.log("ageGroup의 값", ageGroup);

  // 데이터베이스 연결 생성
  // console.log("Database connection successful");
  const connection = await dbPool.promise();

  try {
    // 영화 카운터로 내림차순해서 가져오는 쿼리사용
    const query = `
    SELECT *
    FROM (
      SELECT *
      FROM movies
      WHERE ${gender === "MAN" ? "MAN" : "WOMAN"} > 0
      ORDER BY ${gender === "MAN" ? "MAN" : "WOMAN"} DESC
      LIMIT 20
    ) AS gender_sorted
    ORDER BY
      CASE
        WHEN '${ageGroup}' = 'TEENAGE' THEN gender_sorted.TEENAGE
        WHEN '${ageGroup}' = 'YOUTH' THEN gender_sorted.YOUTH
        WHEN '${ageGroup}' = 'SENIOR' THEN gender_sorted.SENIOR
        WHEN '${ageGroup}' = 'OLDER' THEN gender_sorted.OLDER
      END DESC;
    `;

    // console.log("쿼리가 제대로 작성되나?:", query);

    try {
      const [results, fields] = await connection.execute(query, [
        gender === "MAN" ? "MAN" : "WOMAN",
        gender === "MAN" ? "MAN" : "WOMAN",
        ageGroup,
        ageGroup,
        ageGroup,
        ageGroup,
      ]);

      if (results) {
        // 클라이언트로 영화 정보 전송
        // console.log("클라이언트로 보내주는 영화20개", results);
        res.status(200).json(results);
      } else {
        console.log("결과 없음");
        res.status(404).send("결과 없음");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("쿼리적용실패");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("UserInfoRECmovie엔드포인트에 문제가 있음");
  }
});

module.exports = router;
