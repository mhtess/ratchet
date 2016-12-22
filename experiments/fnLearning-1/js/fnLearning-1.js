function make_slides(f) {
  var   slides = {};

  slides.i0 = slide({
     name : "i0",
     start: function() {
       $("#timeMinutes").html(Math.round(
       (exp.training_stims.length + exp.test_stims.length) / 6))
      exp.startT = Date.now();
     }
  });

  slides.instructions = slide({
    name : "instructions",
    start: function() {
      $(".trainingTrials").html(exp.training_stims.length);
      $(".testTrials").html(exp.test_stims.length);
    },
    button : function() {
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.intermediate_instructions = slide({
    name : "intermediate_instructions",
    start: function() {
      $(".testTrials").html(exp.test_stims.length);
    },
    button : function() {
      exp.go();
    }
  });


  slides.fn_learning_train = slide({
    name : "fn_learning_train",
    present : _.shuffle(exp.training_stims),
    present_handle : function(stim) {
      $(".err").hide();
      $(".adjust").hide();

      this.stim = stim;
      // might need to change the id tags to classes

      $(".vertical_question").html("Different sized bugs live at different heights on the tree.<br> For this bug on the left, how high on the tree does it live?");
      $("#sliders_train").empty();

      $("#sliders_train").append("<td><svg id='svg_bug_train'></svg></td><td class='blank'></td>");
      $("#sliders_train").append("<td><svg id='svg_tree_train'></svg></td>");
      $("#sliders_train").append("<td id='slider_col_train'><div id='vslider0_train' class='vertical_slider'>|</div></td>");
      $("#sliders_train").append("<td id='slider_col1_train'><div id='vslider1_train' class='vertical_slider'>|</div></td>");
      $("#slider_col1_train").hide();
      var scale = 1;

      // var color = "#800000"
      Ecosystem.draw("bug",
      {
        "tar1":true,
        "tar2":true,
        "prop1":1,
        "prop2":1,
        "col1":{"mean":exp.color},
        "col2":{"mean":exp.color},
        "col3":{"mean":exp.color},
        "col4":{"mean":exp.color},
        "col5":{"mean":exp.color},
        "var":0.1
      }, "svg_bug_train", this.stim.x)

      Ecosystem.draw("tree",
      {
        "tar1":false,
        "tar2":false,
        "prop1":0.02,
        "prop2":1,
        "col1":{"mean":exp.color},
        "col2":{"mean":exp.color},
        "col3":{"mean":exp.color},
        "col4":{"mean":exp.color},
        "col5":{"mean":exp.color},
      }, "svg_tree_train", 2 )

      this.init_sliders();
      exp.sliderPost = [];

      var label = "#vslider1_train";

      $(label+ ' .ui-slider-handle').show();
      $(label).slider({value:this.stim.y});
      $(label).css({"background":"#99D6EB"});
      $(label + ' .ui-slider-handle').css({
        "background":"#667D94",
        "border-color": "#001F29"
      })
      $(label).unbind("mousedown");
      exp.sliderPost = [];

    },
    button : function() {
      // LOGIC: touched slider ?
      // show other slider with correct answer
      // make participant adjust their slider to match
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else if (!$("#slider_col1_train").is(":visible")){
        $("#slider_col1_train").show();
        $(".adjust").show();
        $(".err").hide();
      } else if (
        (exp.sliderPost[0] < this.stim.y - 0.04) ||
        (exp.sliderPost[0] > this.stim.y + 0.04)
      ) {
        $(".err").hide();
        $(".adjust").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0_train", this.make_slider_callback(), "vertical");
      utils.make_slider("#vslider1_train", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning_train",
        "input" : this.stim.x,
        // "output" : this.stim.y,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.fn_learning_test = slide({
    name : "fn_learning_test",
    present : _.shuffle(exp.test_stims),
    present_handle : function(stim) {
      $(".err").hide();
      this.stim = stim;

      $(".vertical_question").html("Different sized bugs live on different parts of the tree.<br> For a bug this size, how high on the tree does it live?");
      $(".sliders").empty();

      $(".sliders").append("<td><svg id='svg_bug'></svg></td><td id='blank'></td>");
      $(".sliders").append("<td><svg id='svg_tree'></svg></td>");
      $(".sliders").append("<td id='slider_col'><div id='vslider0' class='vertical_slider'>|</div></td>");
      var scale = 1;

      var color = "#800000"
      Ecosystem.draw("bug",
      {
        "tar1":true,
        "tar2":true,
        "prop1":1,
        "prop2":1,
        "col1":{"mean":exp.color},
        "col2":{"mean":exp.color},
        "col3":{"mean":exp.color},
        "col4":{"mean":exp.color},
        "col5":{"mean":exp.color},
        "var":0.1
      }, "svg_bug", stim.x)

      Ecosystem.draw("tree",
      {
        "tar1":false,
        "tar2":false,
        "prop1":0.02,
        "prop2":1,
        "col1":{"mean":exp.color},
        "col2":{"mean":exp.color},
        "col3":{"mean":exp.color},
        "col4":{"mean":exp.color},
        "col5":{"mean":exp.color},
      }, "svg_tree", 2 )

      this.init_sliders();
      exp.sliderPost = [];
    },
    button : function() {
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        // $("#svg_bug").empty();
        // var color = "#FFFFFF"
        // Ecosystem.draw("bug",
        // {
        //   "tar1":false,
        //   "tar2":false,
        //   "prop1":0.2,
        //   "prop2":1,
        //   "col1":{"mean":color},
        //   "col2":{"mean":color},
        //   "col3":{"mean":color},
        //   "col4":{"mean":color},
        //   "col5":{"mean":color},
        //   "var":0.1
        // }, "svg_bug", ui.value)
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning",
        "question" : this.stim.question,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.subj_info =  slide({
    name : "subj_info",
    submit : function(e){
      //if (e.preventDefault) e.preventDefault(); // I don't know what this means.
      exp.subj_data = {
        language : $("#language").val(),
        enjoyment : $("#enjoyment").val(),
        asses : $('input[name="assess"]:checked').val(),
        age : $("#age").val(),
        gender : $("#gender").val(),
        education : $("#education").val(),
        comments : $("#comments").val(),
      };
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.thanks = slide({
    name : "thanks",
    start : function() {
      exp.data= {
          "trials" : exp.data_trials,
          "catch_trials" : exp.catch_trials,
          "system" : exp.system,
          "condition" : exp.condition,
          "subject_information" : exp.subj_data,
          "time_in_minutes" : (Date.now() - exp.startT)/60000
      };
      setTimeout(function() {turk.submit(exp.data);}, 1000);
    }
  });

  return slides;
}

/// init ///
function init() {
  exp.color = "#316C0B"
  exp.training_stims = [{x:0.25,y:0.75},{x:0.75, y:0.25}];
  exp.test_stims = [{x:0.33}, {x:0.50}, {x:0.80}];
  exp.trials = [];
  exp.catch_trials = [];
  exp.condition = _.sample(["CONDITION 1", "condition 2"]); //can randomize between subject conditions here
  exp.system = {
      Browser : BrowserDetect.browser,
      OS : BrowserDetect.OS,
      screenH: screen.height,
      screenUH: exp.height,
      screenW: screen.width,
      screenUW: exp.width
    };
  //blocks of the experiment:
  exp.structure=[
    "i0",
    "instructions",
    "fn_learning_train",
    "intermediate_instructions",
    "fn_learning_test",
    "subj_info",
    "thanks"
  ];

  exp.data_trials = [];
  //make corresponding slides:
  exp.slides = make_slides(exp);

  exp.nQs = utils.get_exp_length(); //this does not work if there are stacks of stims (but does work for an experiment with this structure)
                    //relies on structure and slides being defined

  $('.slide').hide(); //hide everything

  //make sure turkers have accepted HIT (or you're not in mturk)
  $("#start_button").click(function() {
    if (turk.previewMode) {
      $("#mustaccept").show();
    } else {
      $("#start_button").click(function() {$("#mustaccept").show();});
      exp.go();
    }
  });

  exp.go(); //show first slide
}
